-- Indicador: peças em estoque com data de aquisição não informada. Filtros: Material e
-- Tipo de peça (Ano não se aplica: é o estoque de hoje).
-- Fórmula: Σ quantidade_em_estoque no último retrato, por material e tipo de peça,
--   para peças sem data_aquisicao (não é possível calcular dias parado; nenhuma data é inventada).
-- Unidade: peças.
WITH ref AS (SELECT max(data_key) AS data_key FROM bi.vw_fato_snapshot_estoque)
SELECT p.material                                 AS "Material",
       p.tipo_peca                                AS "Tipo de peça",
       sum(s.quantidade_em_estoque)::int          AS "Peças",
       'data de aquisição não informada'          AS "Situação"
  FROM ref
  JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key AND s.quantidade_em_estoque > 0
  JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
 WHERE p.data_aquisicao IS NULL
   AND p.material IN ($material)
   AND p.tipo_peca IN ($tipo_peca)
 GROUP BY p.material, p.tipo_peca
 ORDER BY 3 DESC, 1, 2;
