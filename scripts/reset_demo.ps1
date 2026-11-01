# =============================================================================
# reset_demo.ps1 — RESET CONTROLADO do ambiente DEMONSTRATIVO.
#
# OPERAÇÃO DESTRUTIVA sobre dados SINTÉTICOS: executa TRUNCATE em staging_demo
# e dw_demo (exceto o domínio fixo dim_tipo_movimentacao). Preserva config_demo
# e todo o histórico de audit_demo. NÃO afeta nenhuma schema fora da demo.
#
# Execute somente com autorização explícita. O script mostra o que será limpo e
# exige digitar a frase de confirmação exata.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\reset_demo.ps1
# =============================================================================

. "$PSScriptRoot\_comum.ps1"

$frase = 'LIMPAR AMBIENTE DEMO'

Import-ArquivoEnv
Test-VersaoServidor

Write-Etapa "Banco: $($env:PGDATABASE) em $($env:PGHOST):$($env:PGPORT)"
Write-Host 'Linhas atuais que serão removidas:'
$sql = @"
SELECT 'staging_demo.produto_gerado' AS tabela, count(*) FROM staging_demo.produto_gerado
UNION ALL SELECT 'staging_demo.movimento_gerado', count(*) FROM staging_demo.movimento_gerado
UNION ALL SELECT 'dw_demo.dim_produto', count(*) FROM dw_demo.dim_produto
UNION ALL SELECT 'dw_demo.parametro_preco_ouro', count(*) FROM dw_demo.parametro_preco_ouro
UNION ALL SELECT 'dw_demo.fato_compra_item', count(*) FROM dw_demo.fato_compra_item
UNION ALL SELECT 'dw_demo.fato_venda_item', count(*) FROM dw_demo.fato_venda_item
UNION ALL SELECT 'dw_demo.fato_movimentacao_estoque', count(*) FROM dw_demo.fato_movimentacao_estoque
UNION ALL SELECT 'dw_demo.fato_snapshot_estoque', count(*) FROM dw_demo.fato_snapshot_estoque;
"@
Invoke-Psql -Comando $sql | ForEach-Object { Write-Host $_ }

Write-Host ''
Write-Host 'Serão preservados: config_demo (configuração), audit_demo (histórico) e dw_demo.dim_tipo_movimentacao.' -ForegroundColor Yellow
Write-Host "Para confirmar, digite exatamente: $frase" -ForegroundColor Yellow
$resposta = Read-Host 'Confirmação'

if ($resposta -cne $frase) {
    Write-Host 'Reset CANCELADO. Nenhum dado foi alterado.' -ForegroundColor Green
    exit 1
}

Write-Etapa 'Executando reset controlado'
Invoke-Psql -Comando "CALL audit_demo.resetar_ambiente_demo($(ConvertTo-LiteralSql $frase));" | Out-Null
Write-Host 'Reset concluído. Execute scripts\run_demo_etl.ps1 para regenerar a demonstração.' -ForegroundColor Green
