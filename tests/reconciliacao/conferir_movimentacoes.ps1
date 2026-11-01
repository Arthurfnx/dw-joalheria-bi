# Conferencia somente leitura das movimentacoes (pagina 5) contra o PostgreSQL (bi_demo).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH m AS (SELECT m.quantidade, t.codigo_tipo, t.sinal, p.material, d.data, d.ano
           FROM bi_demo.vw_fato_movimentacao_estoque m
           JOIN bi_demo.vw_dim_tipo_movimentacao t USING (tipo_mov_key)
           JOIN bi_demo.vw_dim_produto p USING (produto_key)
           JOIN bi_demo.vw_dim_data d USING (data_key))
SELECT 'eventos', count(*)::text FROM m
UNION ALL SELECT 'qtd_min_fato', min(quantidade)::text FROM m
UNION ALL SELECT codigo_tipo, count(*) || ' eventos / ' || sum(quantidade) || ' pecas' FROM m GROUP BY codigo_tipo
UNION ALL SELECT 'SAIDA_ROUBO_na_dimensao', count(*)::text FROM bi_demo.vw_dim_tipo_movimentacao WHERE codigo_tipo = 'SAIDA_ROUBO'
UNION ALL SELECT 'entradas_sinal_mais', sum(quantidade) FILTER (WHERE sinal = 1)::text FROM m
UNION ALL SELECT 'saidas_sinal_menos', sum(quantidade) FILTER (WHERE sinal = -1)::text FROM m
UNION ALL SELECT 'saldo_liquido_total', sum(quantidade * sinal)::text FROM m
UNION ALL SELECT 'saldo_acumulado_ate_2024_12_31', sum(quantidade * sinal) FILTER (WHERE data <= DATE '2024-12-31')::text FROM m
UNION ALL SELECT 'ouro_entradas_compra', sum(quantidade) FILTER (WHERE material = 'Ouro' AND codigo_tipo = 'ENTRADA_COMPRA')::text FROM m
UNION ALL SELECT 'snapshot_2025_12_31', (SELECT sum(s.quantidade_em_estoque) FROM bi_demo.vw_fato_snapshot_estoque s JOIN bi_demo.vw_dim_data d USING (data_key) WHERE d.data = DATE '2025-12-31')::text
UNION ALL SELECT 'snapshot_2024_12_31', (SELECT sum(s.quantidade_em_estoque) FROM bi_demo.vw_fato_snapshot_estoque s JOIN bi_demo.vw_dim_data d USING (data_key) WHERE d.data = DATE '2024-12-31')::text;
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas
