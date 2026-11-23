-- Indicador: tipo de peça que mais fica parado.
-- Fórmulas (só peças em estoque hoje com data de aquisição):
--   Dias parado = data de referência da carga − data_aquisicao;
--   Mediana e média dos dias parado por tipo de peça;
--   % acima de 180 dias = peças com mais de 180 dias parado ÷ peças com data.
-- "Sem data" = peças do tipo em estoque sem data de aquisição (fora do cálculo).
-- Unidades: dias, peças e %. Ordem: mediana, depois média, da maior para a menor.
WITH ref AS (
    SELECT max(data_key) AS data_key,
           to_date(max(data_key)::text, 'YYYYMMDD') AS data_ref
      FROM bi.vw_fato_snapshot_estoque
),
e AS (
    SELECT p.tipo_peca, s.quantidade_em_estoque AS qtd,
           CASE WHEN p.data_aquisicao IS NOT NULL THEN ref.data_ref - p.data_aquisicao END AS dias
      FROM ref
      JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key AND s.quantidade_em_estoque > 0
      JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
),
t AS (
    SELECT tipo_peca,
           sum(qtd) FILTER (WHERE dias IS NOT NULL)            AS com_data,
           sum(qtd) FILTER (WHERE dias IS NULL)                AS sem_data,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY dias)   AS mediana,
           avg(dias)                                           AS media,
           sum(qtd) FILTER (WHERE dias > 180)                  AS acima_180
      FROM e
     GROUP BY tipo_peca
)
SELECT tipo_peca                                                           AS "Tipo de peça",
       com_data::int                                                       AS "Peças com data",
       translate(to_char(mediana, 'FM99990.0'), '.', ',')                  AS "Mediana de dias parado",
       translate(to_char(media, 'FM99990.0'), '.', ',')                    AS "Média de dias parado",
       translate(to_char(100.0 * COALESCE(acima_180, 0) / com_data, 'FM990.0'), '.', ',') || '%' AS "% acima de 180 dias",
       COALESCE(sem_data, 0)::int                                          AS "Sem data (fora do cálculo)"
  FROM t
 WHERE com_data > 0
 ORDER BY mediana DESC, media DESC, tipo_peca;
