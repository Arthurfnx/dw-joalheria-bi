# =============================================================================
# run_tests.ps1 — testes automatizados do ambiente DEMONSTRATIVO.
#
# Executa tests/sql/*.sql (cada arquivo roda em BEGIN ... ROLLBACK e não altera
# o banco). Requer que scripts\run_demo_etl.ps1 já tenha sido executado.
#
#   -ComReexecucao : executa o ETL mais uma vez e confirma IDEMPOTÊNCIA (as
#                    contagens do DW não mudam) e DETERMINISMO (REP-02 com md5
#                    igual ao da execução anterior). Cria uma nova execução em
#                    audit_demo e novas linhas em staging_demo (por execução).
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1 [-ComReexecucao]
# =============================================================================
param([switch]$ComReexecucao)

. "$PSScriptRoot\_comum.ps1"

Import-ArquivoEnv
Test-VersaoServidor

$falhas = 0
$arquivos = Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'tests\sql') -Filter '*.sql' | Sort-Object Name
foreach ($a in $arquivos) {
    Write-Etapa "Teste $($a.Name)"
    try {
        Invoke-Psql -Arquivo $a.FullName -MostrarMensagens | Out-Null
    } catch {
        $falhas++
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

if ($ComReexecucao) {
    $sqlContagens = @"
SELECT concat_ws(';',
  (SELECT count(*) FROM dw_demo.dim_produto),
  (SELECT count(*) FROM dw_demo.dim_data),
  (SELECT count(*) FROM dw_demo.parametro_preco_ouro),
  (SELECT count(*) FROM dw_demo.fato_compra_item),
  (SELECT count(*) FROM dw_demo.fato_venda_item),
  (SELECT count(*) FROM dw_demo.fato_movimentacao_estoque),
  (SELECT count(*) FROM dw_demo.fato_snapshot_estoque),
  (SELECT coalesce(sum(valor_realizado_total), 0) FROM dw_demo.fato_venda_item),
  (SELECT coalesce(sum(custo_total_pago), 0) FROM dw_demo.fato_compra_item));
"@
    Write-Etapa 'Idempotência: contagens antes da reexecução'
    $antes = (Invoke-Psql -Comando $sqlContagens -Tuplas | Select-Object -First 1).Trim()
    Write-Host "   $antes"

    Write-Etapa 'Reexecutando o ETL com a mesma configuração'
    & (Join-Path $PSScriptRoot 'run_demo_etl.ps1')
    if ($LASTEXITCODE -ne 0) {
        $falhas++
        Write-Host 'FALHA [REP-01]: a reexecução do ETL não terminou com sucesso.' -ForegroundColor Red
    }

    $depois = (Invoke-Psql -Comando $sqlContagens -Tuplas | Select-Object -First 1).Trim()
    Write-Host "   depois: $depois"
    if ($antes -ne $depois) {
        $falhas++
        Write-Host 'FALHA [REP-01]: a reexecução alterou contagens ou totais do DW.' -ForegroundColor Red
    } else {
        Write-Host '   OK REP-01: reexecução não duplicou nem alterou registros.' -ForegroundColor Green
    }

    $rep02 = (Invoke-Psql -Tuplas -Comando @"
SELECT aprovado::text || '|' || obtido
  FROM audit_demo.resultado_validacao
 WHERE codigo = 'REP-02'
   AND id_execucao = (SELECT max(id_execucao) FROM audit_demo.execucao);
"@ | Select-Object -First 1)
    if ($null -eq $rep02 -or -not $rep02.StartsWith('true|') -or $rep02.Contains('N/A')) {
        $falhas++
        Write-Host "FALHA [REP-02]: determinismo não confirmado ($rep02)." -ForegroundColor Red
    } else {
        Write-Host "   OK REP-02: $rep02" -ForegroundColor Green
    }
}

Write-Host ''
if ($falhas -eq 0) {
    Write-Host 'Todos os testes passaram.' -ForegroundColor Green
    exit 0
}
Write-Host "$falhas teste(s) falharam." -ForegroundColor Red
exit 1
