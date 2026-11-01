# Conferencia somente leitura dos indicadores da pagina 4 (Compras e Custos) contra o PostgreSQL (bi_demo).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH c AS (SELECT c.*, p.material, p.tipo_peca, p.descricao, d.data, d.ano
           FROM bi_demo.vw_fato_compra_item c
           JOIN bi_demo.vw_dim_produto p USING (produto_key)
           JOIN bi_demo.vw_dim_data d USING (data_key))
SELECT 'custo_total', round(sum(custo_total_pago)::numeric, 2)::text FROM c
UNION ALL SELECT 'quantidade_adquirida', sum(quantidade_recebida)::text FROM c
UNION ALL SELECT 'entradas_distintas', count(DISTINCT id_entrada_sintetica)::text FROM c
UNION ALL SELECT 'custo_medio_ponderado', round((sum(custo_total_pago) / sum(quantidade_recebida))::numeric, 2)::text FROM c
UNION ALL SELECT 'itens_de_compra', count(*)::text FROM c
UNION ALL SELECT 'custo_2024', round(sum(custo_total_pago) FILTER (WHERE ano = 2024)::numeric, 2)::text FROM c
UNION ALL SELECT 'custo_2025', round(sum(custo_total_pago) FILTER (WHERE ano = 2025)::numeric, 2)::text FROM c
UNION ALL SELECT 'custo_ouro', round(sum(custo_total_pago) FILTER (WHERE material = 'Ouro')::numeric, 2)::text FROM c
UNION ALL SELECT 'qtd_folheado', sum(quantidade_recebida) FILTER (WHERE material = 'Folheado')::text FROM c
UNION ALL SELECT 'qtd_anel', sum(quantidade_recebida) FILTER (WHERE tipo_peca = 'Anel')::text FROM c
UNION ALL SELECT 'periodo_mar_jun_2025_custo', round(sum(custo_total_pago) FILTER (WHERE data BETWEEN DATE '2025-03-01' AND DATE '2025-06-30')::numeric, 2)::text FROM c
UNION ALL SELECT 'periodo_mar_jun_2025_entradas', count(DISTINCT id_entrada_sintetica) FILTER (WHERE data BETWEEN DATE '2025-03-01' AND DATE '2025-06-30')::text FROM c
UNION ALL SELECT 'ouro_anel_2025_custo', round(sum(custo_total_pago) FILTER (WHERE ano = 2025 AND material = 'Ouro' AND tipo_peca = 'Anel')::numeric, 2)::text FROM c
UNION ALL (SELECT 'top1_produto_custo', descricao || ' = ' || round(sum(custo_total_pago)::numeric, 2)
           FROM c GROUP BY descricao ORDER BY sum(custo_total_pago) DESC LIMIT 1);
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas
