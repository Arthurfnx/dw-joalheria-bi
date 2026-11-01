# Conferência somente leitura dos indicadores das páginas 2 e 3 contra o PostgreSQL (bi_demo).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH v AS (SELECT * FROM bi_demo.vw_fato_venda_item),
     ult AS (SELECT max(d.data) AS data FROM bi_demo.vw_fato_snapshot_estoque s JOIN bi_demo.vw_dim_data d USING (data_key)),
     snap AS (SELECT s.*, p.material, p.peso_g FROM bi_demo.vw_fato_snapshot_estoque s
              JOIN bi_demo.vw_dim_data d USING (data_key) JOIN bi_demo.vw_dim_produto p USING (produto_key)
              WHERE d.data = (SELECT data FROM ult))
SELECT 'receita_realizada', round(sum(valor_realizado_total)::numeric, 2)::text FROM v
UNION ALL SELECT 'quantidade_vendida', sum(quantidade_vendida)::text FROM v
UNION ALL SELECT 'numero_vendas', count(DISTINCT id_venda_sintetica)::text FROM v
UNION ALL SELECT 'ticket_medio', round((sum(valor_realizado_total) / count(DISTINCT id_venda_sintetica))::numeric, 2)::text FROM v
UNION ALL SELECT 'preco_medio_realizado', round((sum(valor_realizado_total) / sum(quantidade_vendida))::numeric, 2)::text FROM v
UNION ALL SELECT 'preco_medio_marcado', round((sum(valor_marcado_total) / sum(quantidade_vendida))::numeric, 2)::text FROM v
UNION ALL SELECT 'valor_marcado_vendido', round(sum(valor_marcado_total)::numeric, 2)::text FROM v
UNION ALL SELECT 'desconto_pct', round((100 * sum(diferenca_marcado_realizado) / sum(valor_marcado_total))::numeric, 2)::text FROM v
UNION ALL SELECT 'receita_ouro', round(sum(v.valor_realizado_total)::numeric, 2)::text FROM v JOIN bi_demo.vw_dim_produto p USING (produto_key) WHERE p.material = 'Ouro'
UNION ALL SELECT 'receita_anel', round(sum(v.valor_realizado_total)::numeric, 2)::text FROM v JOIN bi_demo.vw_dim_produto p USING (produto_key) WHERE p.tipo_peca = 'Anel'
UNION ALL SELECT 'qtd_anel', sum(v.quantidade_vendida)::text FROM v JOIN bi_demo.vw_dim_produto p USING (produto_key) WHERE p.tipo_peca = 'Anel'
UNION ALL (SELECT 'top1_produto_receita', p.descricao || ' = ' || round(sum(v.valor_realizado_total)::numeric, 2)
           FROM v JOIN bi_demo.vw_dim_produto p USING (produto_key) GROUP BY p.descricao ORDER BY sum(v.valor_realizado_total) DESC LIMIT 1)
UNION ALL SELECT 'data_ultima_posicao', (SELECT data FROM ult)::text
UNION ALL SELECT 'estoque_atual_pecas', sum(quantidade_em_estoque)::text FROM snap
UNION ALL SELECT 'produtos_sem_estoque', count(*) FILTER (WHERE quantidade_em_estoque = 0)::text FROM snap
UNION ALL SELECT 'peso_ouro_g', round(sum(quantidade_em_estoque * peso_g) FILTER (WHERE material = 'Ouro')::numeric, 3)::text FROM snap
UNION ALL SELECT 'produtos_cadastrados', count(*)::text FROM bi_demo.vw_dim_produto
UNION ALL SELECT 'produtos_sem_venda_periodo', count(*)::text FROM snap s
          WHERE s.quantidade_em_estoque > 0 AND NOT EXISTS (SELECT 1 FROM v WHERE v.produto_key = s.produto_key);
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas
