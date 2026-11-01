# =============================================================================
# run_migrations.ps1 — INICIALIZAÇÃO do ambiente DEMONSTRATIVO no banco
# informado em PGDATABASE (o banco precisa existir; ver criar_banco.ps1).
#
# Aplica, em ordem e de forma idempotente:
#   1. db/migrations/*.sql   (schemas *_demo, tabelas, restrições, gatilhos)
#   2. etl/sql/demo/*.sql    (configuração padrão, funções e procedures do ETL)
#   3. db/views/*.sql        (views bi_demo)
# Não cria o banco, não executa o ETL e não apaga dados.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1
#       powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1 -SomenteListar
# =============================================================================
param(
    [switch]$SomenteListar
)

. "$PSScriptRoot\_comum.ps1"

$arquivos = @()
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'db\migrations') -Filter '*.sql' | Sort-Object Name
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'etl\sql\demo') -Filter '*.sql' | Sort-Object Name
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'db\views') -Filter '*.sql' | Sort-Object Name

Write-Etapa 'Arquivos que serão aplicados (nesta ordem):'
foreach ($a in $arquivos) {
    Write-Host ('   ' + $a.FullName.Substring($RaizProjeto.Length + 1))
}
if ($SomenteListar) { return }

Import-ArquivoEnv
Test-VersaoServidor

# -----------------------------------------------------------------------------
# Controle de migrations (audit_demo.migracao_aplicada).
# A tabela de controle só existe após 002_audit_demo.sql. Por isso:
#   - arquivos executados com sucesso ANTES de a tabela existir ficam em uma
#     fila em memória e são registrados assim que ela estiver disponível;
#   - depois disso, cada arquivo é registrado logo após sua execução;
#   - um arquivo que falhou nunca é registrado (o script para no erro);
#   - arquivos não executados nunca são registrados.
# Todos os arquivos são idempotentes (IF NOT EXISTS, CREATE OR REPLACE,
# ON CONFLICT DO NOTHING); uma execução interrompida é retomada reaplicando
# a sequência, sem DROP nem reset.
# -----------------------------------------------------------------------------
function Test-ControleDisponivel {
    $r = (Invoke-Psql -Tuplas -Comando "SELECT to_regclass('audit_demo.migracao_aplicada') IS NOT NULL;" | Select-Object -First 1)
    return ($null -ne $r -and $r.Trim() -eq 't')
}

function Get-HashRegistrado([string]$Relativo) {
    $r = Invoke-Psql -Tuplas -Comando "SELECT sha256 FROM audit_demo.migracao_aplicada WHERE arquivo = $(ConvertTo-LiteralSql $Relativo);" | Select-Object -First 1
    if ($null -eq $r) { return $null }
    $t = $r.Trim()
    if ($t -eq '') { return $null }
    return $t
}

function Register-Migracao([string]$Relativo, [string]$Hash) {
    $sql = "INSERT INTO audit_demo.migracao_aplicada (arquivo, sha256) VALUES ($(ConvertTo-LiteralSql $Relativo), '$Hash') " +
           "ON CONFLICT (arquivo) DO UPDATE SET sha256 = EXCLUDED.sha256, aplicado_em = clock_timestamp();"
    Invoke-Psql -Comando $sql | Out-Null
    Write-Host "   registrado em audit_demo.migracao_aplicada (sha256 $($Hash.Substring(0, 12))...)"
}

$pendentes = New-Object System.Collections.ArrayList
$controle = Test-ControleDisponivel
$aplicados = 0
$advertencias = 0

foreach ($a in $arquivos) {
    $relativo = $a.FullName.Substring($RaizProjeto.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -LiteralPath $a.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

    # Conferência do SHA-256 com o registro anterior (quando houver).
    if ($controle) {
        $hashAnterior = Get-HashRegistrado $relativo
        if ($null -ne $hashAnterior -and $hashAnterior -ne $hash) {
            $advertencias++
            Write-Warning ("$relativo mudou desde a última aplicação (sha256 anterior $($hashAnterior.Substring(0, 12))..., atual $($hash.Substring(0, 12))...). " +
                           'Instruções CREATE ... IF NOT EXISTS não alteram objetos já existentes; avalie a necessidade de uma nova migration.')
        }
    }

    Write-Etapa "Aplicando $relativo"
    Invoke-Psql -Arquivo $a.FullName | Out-Null   # em caso de erro, lança exceção e nada é registrado
    $aplicados++

    if (-not $controle) {
        $controle = Test-ControleDisponivel
        if (-not $controle) {
            [void]$pendentes.Add(@{ Relativo = $relativo; Hash = $hash })
            Write-Host '   aplicado; registro adiado (tabela de controle ainda não existe)'
            continue
        }
        foreach ($p in $pendentes) {
            Write-Host "   registrando migration executada anteriormente nesta sessão: $($p.Relativo)"
            Register-Migracao $p.Relativo $p.Hash
        }
        $pendentes.Clear()
    }
    Register-Migracao $relativo $hash
}

if ($pendentes.Count -gt 0) {
    throw "Migrations aplicadas sem registro (tabela audit_demo.migracao_aplicada inexistente): $(($pendentes | ForEach-Object { $_.Relativo }) -join ', ')"
}

Write-Etapa "Inicialização concluída: $aplicados arquivo(s) aplicado(s); $advertencias advertência(s) de hash."
Write-Host 'Próximo passo: scripts\run_demo_etl.ps1'
