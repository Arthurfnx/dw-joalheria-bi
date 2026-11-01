# Conferencia somente leitura das janelas comerciais (Todos, 2024, 2025) contra o PostgreSQL (bi_demo).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH dias AS (
  SELECT janela_comercial, ano, count(*) AS dias FROM bi_demo.vw_dim_data
  WHERE janela_comercial IS NOT NULL GROUP BY janela_comercial, ano),
vend AS (
  SELECT d.janela_comercial, d.ano, sum(v.valor_realizado_total) AS receita, sum(v.quantidade_vendida) AS pecas
  FROM bi_demo.vw_fato_venda_item v JOIN bi_demo.vw_dim_data d USING (data_key)
  WHERE d.janela_comercial IS NOT NULL GROUP BY d.janela_comercial, d.ano),
base AS (SELECT dias.janela_comercial, dias.ano, dias.dias, coalesce(vend.receita, 0) AS receita, coalesce(vend.pecas, 0) AS pecas
         FROM dias LEFT JOIN vend USING (janela_comercial, ano))
SELECT 'Todos', janela_comercial, sum(dias), round(sum(receita)::numeric, 2), sum(pecas), round((sum(receita) / sum(dias))::numeric, 2)
  FROM base GROUP BY janela_comercial
UNION ALL
SELECT ano::text, janela_comercial, dias, round(receita::numeric, 2), pecas, round((receita / dias)::numeric, 2) FROM base
ORDER BY 1, 4 DESC;
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas
