# =============================================================================
# conferir_relatorio_real.ps1 — conferência SOMENTE LEITURA dos indicadores do
# relatório REAL (powerbi/relatorio_joalheria.pbip) contra o esquema bi.
# Recalcula no SQL, com as mesmas regras das medidas DAX, os números das
# páginas (período completo, sem filtros). Não imprime nomes nem descrições.
# Uso: powershell -ExecutionPolicy Bypass -File tests\reconciliacao\conferir_relatorio_real.ps1
# =============================================================================
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH v AS (SELECT * FROM bi.vw_fato_venda_item),
     c AS (SELECT * FROM bi.vw_fato_compra_item),
     m AS (SELECT f.*, t.sinal, t.codigo_tipo FROM bi.vw_fato_movimentacao_estoque f JOIN bi.vw_dim_tipo_movimentacao t USING (tipo_mov_key)),
     ult AS (SELECT max(d.data) AS data FROM bi.vw_fato_snapshot_estoque s JOIN bi.vw_dim_data d USING (data_key)),
     snap AS (SELECT s.*, p.material, p.peso_g FROM bi.vw_fato_snapshot_estoque s
              JOIN bi.vw_dim_data d USING (data_key) JOIN bi.vw_dim_produto p USING (produto_key)
              WHERE d.data = (SELECT data FROM ult))
-- Vendas (páginas Visão Geral e Vendas)
SELECT '01 receita_realizada (sem simbólico)', coalesce(round(sum(valor_faturado), 2), 0)::text FROM v
UNION ALL SELECT '02 receita_aplicacao', coalesce(round(sum(valor_faturado) FILTER (WHERE origem_dado = 'APLICACAO'), 2), 0)::text FROM v
UNION ALL SELECT '03 receita_planilha', coalesce(round(sum(valor_faturado) FILTER (WHERE origem_dado = 'PLANILHA'), 2), 0)::text FROM v
UNION ALL SELECT '04 quantidade_vendida', coalesce(sum(quantidade_vendida), 0)::text FROM v
UNION ALL SELECT '05 quantidade_aplicacao', coalesce(sum(quantidade_vendida) FILTER (WHERE origem_dado = 'APLICACAO'), 0)::text FROM v
UNION ALL SELECT '06 quantidade_planilha', coalesce(sum(quantidade_vendida) FILTER (WHERE origem_dado = 'PLANILHA'), 0)::text FROM v
UNION ALL SELECT '07 vendas_fora_faturamento_pecas', coalesce(sum(quantidade_vendida) FILTER (WHERE NOT entra_faturamento), 0)::text FROM v
UNION ALL SELECT '08 numero_vendas (só aplicação)', count(DISTINCT id_venda)::text FROM v
UNION ALL SELECT '09 ticket_medio (só aplicação)',
       coalesce(round(sum(valor_faturado) FILTER (WHERE origem_dado = 'APLICACAO') / nullif(count(DISTINCT id_venda), 0), 2)::text, '(vazio)') FROM v
UNION ALL SELECT '10 preco_medio_realizado',
       coalesce(round(sum(valor_faturado) / nullif(sum(quantidade_vendida) FILTER (WHERE entra_faturamento), 0), 2)::text, '(vazio)') FROM v
UNION ALL SELECT '11 preco_medio_marcado',
       coalesce(round(sum(valor_marcado_total) / nullif(sum(quantidade_vendida) FILTER (WHERE valor_marcado_total IS NOT NULL), 0), 2)::text, '(vazio)') FROM v
UNION ALL SELECT '12 desconto_pct',
       coalesce(round(100 * sum(diferenca_marcado_realizado) / nullif(sum(valor_marcado_total), 0), 2)::text, '(vazio)') FROM v
-- Estoque (Estoque e Produtos)
UNION ALL SELECT '20 data_ultima_posicao', coalesce((SELECT data FROM ult)::text, '(vazio)')
UNION ALL SELECT '21 estoque_atual_pecas', coalesce(sum(quantidade_em_estoque), 0)::text FROM snap
UNION ALL SELECT '22 produtos_sem_estoque', count(*) FILTER (WHERE quantidade_em_estoque = 0)::text FROM snap
UNION ALL SELECT '23 produtos_com_estoque', count(*) FILTER (WHERE quantidade_em_estoque > 0)::text FROM snap
UNION ALL SELECT '24 peso_ouro_g', coalesce(round(sum(quantidade_em_estoque * peso_g) FILTER (WHERE material = 'Ouro'), 1), 0)::text FROM snap
UNION ALL SELECT '25 produtos_cadastrados', count(*)::text FROM bi.vw_dim_produto
UNION ALL SELECT '26 produtos_consignados_em_estoque', count(*)::text FROM snap s JOIN bi.vw_dim_produto p USING (produto_key)
          WHERE s.quantidade_em_estoque > 0 AND p.local_estoque = 'Consignado'
-- Compras e Custos
UNION ALL SELECT '30 custo_total_compras', coalesce(round(sum(custo_total_pago), 2), 0)::text FROM c
UNION ALL SELECT '31 quantidade_adquirida', coalesce(sum(quantidade_recebida), 0)::text FROM c
UNION ALL SELECT '32 entradas_de_compra (linhas)', count(*)::text FROM c
UNION ALL SELECT '33 custo_medio_ponderado', coalesce(round(sum(custo_total_pago) / nullif(sum(quantidade_recebida), 0), 2)::text, '(vazio)') FROM c
-- Movimentações
UNION ALL SELECT '40 eventos_movimentacao', count(*)::text FROM m
UNION ALL SELECT '41 entradas_pecas', coalesce(sum(quantidade) FILTER (WHERE sinal = 1), 0)::text FROM m
UNION ALL SELECT '42 saidas_pecas', coalesce(sum(quantidade) FILTER (WHERE sinal = -1), 0)::text FROM m
UNION ALL SELECT '43 saldo_liquido (= estoque atual)', coalesce(sum(quantidade * sinal), 0)::text FROM m
UNION ALL SELECT '44 implantacao_pecas', coalesce(sum(quantidade) FILTER (WHERE codigo_tipo = 'IMPLANTACAO'), 0)::text FROM m
UNION ALL SELECT '45 saidas_por_venda', coalesce(sum(quantidade) FILTER (WHERE codigo_tipo = 'SAIDA_VENDA'), 0)::text FROM m
UNION ALL SELECT '46 estornos_de_venda', coalesce(sum(quantidade) FILTER (WHERE codigo_tipo = 'ESTORNO_VENDA'), 0)::text FROM m
UNION ALL SELECT '47 saidas_por_perda', coalesce(sum(quantidade) FILTER (WHERE codigo_tipo = 'SAIDA_PERDA'), 0)::text FROM m
-- Precificação e associação
UNION ALL SELECT '50 preco_ouro_vigente', coalesce((SELECT preco_ouro_1000::text FROM bi.vw_preco_ouro
          WHERE data_referencia <= (SELECT max(data) FROM bi.vw_dim_data) ORDER BY data_referencia DESC LIMIT 1), '(sem registro)')
UNION ALL SELECT '51 registros_preco_ouro', count(*)::text FROM bi.vw_preco_ouro_versoes
UNION ALL SELECT '52 produtos_com_preco_sugerido', count(*) FILTER (WHERE preco_sugerido_atual IS NOT NULL)::text FROM bi.vw_dim_produto
UNION ALL SELECT '53 regras_associacao_produtos', count(*)::text FROM bi.vw_associacao_produtos
UNION ALL SELECT '54 regras_associacao_tipos', count(*)::text FROM bi.vw_associacao_tipos
-- Calendário
UNION ALL SELECT '60 calendario', min(data)::text || ' a ' || max(data)::text FROM bi.vw_dim_data
UNION ALL SELECT '61 dias_em_janelas_comerciais', count(*) FILTER (WHERE janela_comercial IS NOT NULL)::text FROM bi.vw_dim_data
UNION ALL SELECT '62 receita_em_janelas', coalesce(round(sum(v.valor_faturado), 2), 0)::text
          FROM v JOIN bi.vw_dim_data d USING (data_key) WHERE d.janela_comercial IS NOT NULL;
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas | ForEach-Object { Write-Host ('   ' + $_.Replace('|', ' = ')) }
