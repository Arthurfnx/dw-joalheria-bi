# =============================================================================
# run_demo_etl.ps1 — EXECUÇÃO do ETL demonstrativo (dados SINTÉTICOS).
#
# Etapas (cada uma em transação própria; para no primeiro erro):
#   1. audit_demo.iniciar_execucao()          -> id da execução
#   2. audit_demo.verificar_configuracao(id)  -> valida config e compara hash
#   3. staging_demo.gerar_demo(id)            -> catálogo, ouro, simulação
#   4. staging_demo.validar_staging(id)       -> rejeições em audit_demo
#   5. dw_demo.carregar_dimensoes(id)
#   6. dw_demo.carregar_fatos(id)
#   7. dw_demo.gerar_snapshots(id)
#   8. audit_demo.executar_verificacoes(id)   -> resultado em audit_demo
#   9. audit_demo.finalizar_execucao(id, SUCESSO|FALHA)
#
# Reexecutar com a mesma configuração não duplica registros. Se a configuração
# mudou, a etapa 2 falha e indica o reset controlado (scripts\reset_demo.ps1).
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\run_demo_etl.ps1
# =============================================================================

. "$PSScriptRoot\_comum.ps1"

Import-ArquivoEnv
Test-VersaoServidor

Write-Etapa 'Abrindo execução em audit_demo'
$idExecucao = [long]((Invoke-Psql -Comando 'SELECT audit_demo.iniciar_execucao();' -Tuplas | Select-Object -First 1).Trim())
Write-Host "   id_execucao = $idExecucao"

$etapas = @(
    @{ Nome = 'Verificando configuração e hash';        Sql = "CALL audit_demo.verificar_configuracao($idExecucao);" },
    @{ Nome = 'Gerando dados sintéticos (staging_demo)'; Sql = "CALL staging_demo.gerar_demo($idExecucao);" },
    @{ Nome = 'Validando staging';                       Sql = "CALL staging_demo.validar_staging($idExecucao);" },
    @{ Nome = 'Carregando dimensões';                    Sql = "CALL dw_demo.carregar_dimensoes($idExecucao);" },
    @{ Nome = 'Carregando fatos';                        Sql = "CALL dw_demo.carregar_fatos($idExecucao);" },
    @{ Nome = 'Gerando snapshots mensais';               Sql = "CALL dw_demo.gerar_snapshots($idExecucao);" }
)

try {
    foreach ($etapa in $etapas) {
        Write-Etapa $etapa.Nome
        $inicio = Get-Date
        Invoke-Psql -Comando $etapa.Sql -MostrarMensagens | Out-Null
        Write-Host ('   concluída em {0:N1} s' -f ((Get-Date) - $inicio).TotalSeconds)
    }

    Write-Etapa 'Executando verificações de qualidade'
    $falhas = [int]((Invoke-Psql -Comando "SELECT audit_demo.executar_verificacoes($idExecucao);" -Tuplas | Select-Object -First 1).Trim())

    if ($falhas -eq 0) {
        Invoke-Psql -Comando "CALL audit_demo.finalizar_execucao($idExecucao, 'SUCESSO', 'Todas as verificações aprovadas.');" | Out-Null
    } else {
        Invoke-Psql -Comando "CALL audit_demo.finalizar_execucao($idExecucao, 'FALHA', $(ConvertTo-LiteralSql "$falhas verificação(ões) reprovada(s); consulte audit_demo.resultado_validacao."));" | Out-Null
    }
} catch {
    $mensagem = $_.Exception.Message
    if ($mensagem.Length -gt 2000) { $mensagem = $mensagem.Substring(0, 2000) }
    try {
        Invoke-Psql -Comando "CALL audit_demo.finalizar_execucao($idExecucao, 'FALHA', $(ConvertTo-LiteralSql $mensagem));" | Out-Null
    } catch {
        Write-Warning 'Não foi possível registrar a falha em audit_demo.execucao.'
    }
    Write-Host ''
    Write-Host "FALHA na execução $idExecucao" -ForegroundColor Red
    Write-Host $mensagem
    exit 1
}

Write-Etapa 'Resumo das etapas'
Invoke-Psql -Comando "SELECT etapa, linhas_lidas AS lidas, linhas_carregadas AS carregadas, linhas_rejeitadas AS rejeitadas, observacao FROM audit_demo.etapa WHERE id_execucao = $idExecucao ORDER BY id_etapa;" |
    ForEach-Object { Write-Host $_ }

Write-Etapa 'Resultado das verificações'
Invoke-Psql -Comando "SELECT codigo, aprovado, obtido FROM audit_demo.resultado_validacao WHERE id_execucao = $idExecucao ORDER BY codigo;" |
    ForEach-Object { Write-Host $_ }

if ($falhas -eq 0) {
    Write-Host ''
    Write-Host "Execução $idExecucao concluída com SUCESSO (dados SINTÉTICOS)." -ForegroundColor Green
    exit 0
} else {
    Write-Host ''
    Write-Host "Execução $idExecucao concluída com $falhas verificação(ões) reprovada(s)." -ForegroundColor Red
    exit 2
}
