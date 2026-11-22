# =============================================================================
# run_etl_app.ps1 — ETL do DW REAL: banco operacional nobreza_app -> dw_joalheria
# (esquemas staging, dw, bi e audit). RECARGA COMPLETA a cada execução
# (autorizada pelo usuário em 2026-11-22 para staging, dw e bi; audit só
# recebe inserções). Não toca nos esquemas *_demo.
#
# Etapas:
#   1. confere o papel de origem (não pode ler nomes de pessoas)
#   2. audit.iniciar_execucao()                      -> id da execução
#   3. extração de nobreza_app para CSV (etl/sql/app/extracao/extrair_app.psql)
#      em data/processed/etl_app (pasta ignorada pelo Git)
#   4. staging.esvaziar() + \copy dos CSV para staging (HEADER MATCH)
#   5. staging.validar_staging(id)                   -> audit.rejeicao
#   6. dw.carregar(id)                               -> dimensões, fatos, snapshots
#   7. audit.executar_verificacoes(id)               -> audit.resultado_validacao
#   8. audit.finalizar_execucao(id, SUCESSO|FALHA)
#
# Variáveis do .env da raiz (nunca versionado):
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD  -> DW (dw_joalheria)
#   APP_PGHOST, APP_PGPORT                           -> padrão: os mesmos do DW
#   APP_PGDATABASE                                   -> padrão: nobreza_app
#   APP_PGUSER                                       -> padrão: nobreza_leitura_dw
#   APP_PGPASSWORD                                   -> senha do papel de leitura
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\run_etl_app.ps1
# Saída: 0 = sucesso; 1 = erro; 2 = verificação de qualidade reprovada.
# =============================================================================

. "$PSScriptRoot\_comum.ps1"

Import-ArquivoEnv
$env:PGAPPNAME = 'dw-joalheria-etl-app'

function Get-Variavel([string]$Nome, [string]$Padrao) {
    $v = [Environment]::GetEnvironmentVariable($Nome, 'Process')
    if ([string]::IsNullOrWhiteSpace($v)) { return $Padrao }
    return $v
}

$origem = @{
    PGHOST     = Get-Variavel 'APP_PGHOST' $env:PGHOST
    PGPORT     = Get-Variavel 'APP_PGPORT' $env:PGPORT
    PGDATABASE = Get-Variavel 'APP_PGDATABASE' 'nobreza_app'
    PGUSER     = Get-Variavel 'APP_PGUSER' 'nobreza_leitura_dw'
    PGPASSWORD = Get-Variavel 'APP_PGPASSWORD' ''
}

function Invoke-PsqlOrigem {
    <# Executa no banco operacional com o papel de leitura; restaura as PG* do DW ao final. #>
    param([string]$Comando, [switch]$Tuplas)
    $salvas = @{}
    foreach ($k in $origem.Keys) { $salvas[$k] = [Environment]::GetEnvironmentVariable($k, 'Process') }
    try {
        foreach ($k in $origem.Keys) { [Environment]::SetEnvironmentVariable($k, $origem[$k], 'Process') }
        if ($Tuplas) { return Invoke-Psql -Comando $Comando -Tuplas }
        return Invoke-Psql -Comando $Comando
    } finally {
        foreach ($k in $salvas.Keys) { [Environment]::SetEnvironmentVariable($k, $salvas[$k], 'Process') }
    }
}

$pasta = Join-Path $RaizProjeto 'data\processed\etl_app'
if (-not (Test-Path -LiteralPath $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }
$pastaPsql = (Resolve-Path -LiteralPath $pasta).Path.Replace('\', '/')
if ($pastaPsql -match '\s') {
    throw "O caminho '$pastaPsql' contém espaços; o psql (\g) exige um caminho sem espaços. Mova o repositório."
}

# Tabelas carregadas na staging (nome do CSV = nome da tabela).
$tabelas = @('produto', 'tipo_movimentacao', 'venda', 'venda_item', 'venda_historica', 'preco_ouro',
             'movimentacao_estoque', 'saldo_estoque', 'importacao_lote', 'configuracao', 'extracao')

Test-VersaoServidor

# 1. Papel de origem: nunca superusuário e sem acesso às colunas com nomes de pessoas.
Write-Etapa "Conferindo o papel de leitura em $($origem.PGDATABASE)"
$conferencia = (Invoke-PsqlOrigem -Tuplas -Comando @'
SELECT current_user || '|' || current_database() || '|' ||
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)::text || '|' ||
       (has_column_privilege('app.produto', 'consignado_com', 'SELECT')
        OR has_column_privilege('app.produto_origem', 'local_original', 'SELECT')
        OR has_table_privilege('app.usuario', 'SELECT'))::text;
'@ | Select-Object -First 1).Trim().Split('|')
Write-Host "   usuário: $($conferencia[0]); banco: $($conferencia[1])"
if ($conferencia[2] -eq 'true' -or $conferencia[3] -eq 'true') {
    throw ("O papel '$($conferencia[0])' é superusuário ou pode ler nomes de pessoas (consignado_com, local_original ou app.usuario). " +
           'O ETL só roda com o papel nobreza_leitura_dw (seção 6A da especificação).')
}

# 2. Execução.
Write-Etapa 'Abrindo execução em audit'
$idExecucao = [long]((Invoke-Psql -Tuplas -Comando "SELECT audit.iniciar_execucao($(ConvertTo-LiteralSql $conferencia[1]), $(ConvertTo-LiteralSql $conferencia[0]));" | Select-Object -First 1).Trim())
Write-Host "   id_execucao = $idExecucao"

$falhas = -1
try {
    # 3. Extração.
    Write-Etapa 'Extraindo o banco operacional para CSV'
    $inicio = Get-Date
    foreach ($t in $tabelas) {
        $arq = Join-Path $pasta ($t + '.csv')
        if (Test-Path -LiteralPath $arq) { Remove-Item -LiteralPath $arq -Force }
    }
    $script = [System.IO.File]::ReadAllText((Join-Path $RaizProjeto 'etl\sql\app\extracao\extrair_app.psql'), [System.Text.Encoding]::UTF8)
    Invoke-PsqlOrigem -Comando ("\set dir $pastaPsql`n" + $script) | Out-Null
    foreach ($t in $tabelas) {
        if (-not (Test-Path -LiteralPath (Join-Path $pasta ($t + '.csv')))) { throw "Extração incompleta: $t.csv não foi gerado." }
    }
    Write-Host ('   concluída em {0:N1} s' -f ((Get-Date) - $inicio).TotalSeconds)

    # 4. Staging (recarga completa, numa transação).
    Write-Etapa 'Carregando a staging'
    $inicio = Get-Date
    $linhas = New-Object System.Collections.Generic.List[string]
    $linhas.Add('BEGIN;')
    $linhas.Add('CALL staging.esvaziar();')
    foreach ($t in $tabelas) {
        $arq = Join-Path $pasta ($t + '.csv')
        $cabecalho = ([System.IO.File]::ReadLines($arq, [System.Text.Encoding]::UTF8) | Select-Object -First 1).Trim()
        if ($cabecalho -notmatch '^[a-z_]+(,[a-z_]+)*$') { throw "Cabeçalho inesperado em $t.csv." }
        $linhas.Add("\copy staging.$t ($cabecalho) FROM '$($arq.Replace('\', '/'))' WITH (FORMAT csv, HEADER MATCH, ENCODING 'UTF8')")
    }
    $linhas.Add("INSERT INTO audit.etapa (id_execucao, etapa, tabela, iniciado_em, linhas_lidas, linhas_carregadas, linhas_rejeitadas, observacao) " +
                "SELECT $idExecucao, 'carregar_staging', e.tabela, '$($inicio.ToString('o'))'::timestamptz, e.linhas, " +
                "(xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM staging.%I', e.tabela), false, true, '')))[1]::text::bigint, 0, " +
                "'linhas contadas na origem × linhas na staging' FROM staging.extracao e ORDER BY e.tabela;")
    $linhas.Add('COMMIT;')
    Invoke-Psql -Comando ($linhas -join "`n") | Out-Null
    Write-Host ('   concluída em {0:N1} s' -f ((Get-Date) - $inicio).TotalSeconds)

    # 5-6. Validação e carga.
    foreach ($etapa in @(
        @{ Nome = 'Validando a staging';            Sql = "CALL staging.validar_staging($idExecucao);" },
        @{ Nome = 'Carregando o DW (recarga completa)'; Sql = "CALL dw.carregar($idExecucao);" }
    )) {
        Write-Etapa $etapa.Nome
        $inicio = Get-Date
        Invoke-Psql -Comando $etapa.Sql -MostrarMensagens | Out-Null
        Write-Host ('   concluída em {0:N1} s' -f ((Get-Date) - $inicio).TotalSeconds)
    }

    # 7-8. Verificações e fechamento.
    Write-Etapa 'Executando verificações de qualidade'
    $falhas = [int]((Invoke-Psql -Tuplas -Comando "SELECT audit.executar_verificacoes($idExecucao);" | Select-Object -First 1).Trim())
    if ($falhas -eq 0) {
        Invoke-Psql -Comando "CALL audit.finalizar_execucao($idExecucao, 'SUCESSO', 'Todas as verificações aprovadas.');" | Out-Null
    } else {
        Invoke-Psql -Comando "CALL audit.finalizar_execucao($idExecucao, 'FALHA', $(ConvertTo-LiteralSql "$falhas verificação(ões) reprovada(s); consulte audit.resultado_validacao."));" | Out-Null
    }
} catch {
    $mensagem = $_.Exception.Message
    if ($mensagem.Length -gt 2000) { $mensagem = $mensagem.Substring(0, 2000) }
    try {
        Invoke-Psql -Comando "CALL audit.finalizar_execucao($idExecucao, 'FALHA', $(ConvertTo-LiteralSql $mensagem));" | Out-Null
    } catch {
        Write-Warning 'Não foi possível registrar a falha em audit.execucao.'
    }
    Write-Host ''
    Write-Host "FALHA na execução $idExecucao" -ForegroundColor Red
    Write-Host $mensagem
    exit 1
}

Write-Etapa 'Resumo das etapas'
Invoke-Psql -Comando "SELECT etapa, coalesce(tabela, '') AS tabela, linhas_lidas AS lidas, linhas_carregadas AS carregadas, linhas_rejeitadas AS rejeitadas, coalesce(observacao, '') AS observacao FROM audit.etapa WHERE id_execucao = $idExecucao ORDER BY id_etapa;" |
    ForEach-Object { Write-Host $_ }

Write-Etapa 'Rejeições por tabela e regra'
Invoke-Psql -Comando "SELECT tabela_origem, regra, count(*) AS registros FROM audit.rejeicao WHERE id_execucao = $idExecucao GROUP BY 1, 2 ORDER BY 1, 2;" |
    ForEach-Object { Write-Host $_ }

Write-Etapa 'Resultado das verificações'
Invoke-Psql -Comando "SELECT codigo, aprovado, esperado, obtido FROM audit.resultado_validacao WHERE id_execucao = $idExecucao ORDER BY id_resultado;" |
    ForEach-Object { Write-Host $_ }

if ($falhas -eq 0) {
    Write-Host ''
    Write-Host "Execução $idExecucao concluída com SUCESSO." -ForegroundColor Green
    exit 0
} else {
    Write-Host ''
    Write-Host "Execução $idExecucao concluída com $falhas verificação(ões) reprovada(s)." -ForegroundColor Red
    exit 2
}
