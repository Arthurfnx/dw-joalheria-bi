-- Indicador: taxa de venda e tempo até a venda, por material.
-- Filtros: Material e Tipo de peça (vendas e estoque); Ano só nas vendas.
-- Não é "giro de estoque" tradicional (que exige custo das vendas e estoque médio
-- valorizado, inexistentes nas fontes).
-- Fórmulas:
--   Taxa de venda (%) = peças vendidas nos anos escolhidos ÷ (essas peças vendidas + peças em
--     estoque hoje); estoque hoje = último retrato diário (bi.vw_fato_snapshot_estoque);
--   Tempo até a venda (dias) = data da venda − data_aquisicao do produto, só para vendas
--     cujo produto tem data de aquisição; vendas com aquisição posterior à venda
--     (inconsistência de cadastro) ficam fora da amostra.
--   Amostra = número de vendas usadas no tempo até a venda.
-- Unidades: peças, %, dias.
WITH estoque AS (
    SELECT p.material, sum(s.quantidade_em_estoque) AS pecas
      FROM bi.vw_fato_snapshot_estoque s
      JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
     WHERE s.data_key = (SELECT max(data_key) FROM bi.vw_fato_snapshot_estoque)
       AND p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
     GROUP BY p.material
),
venda AS (
    SELECT p.material,
           sum(v.quantidade_vendida) AS pecas,
           count(*) FILTER (WHERE p.data_aquisicao <= v.data_hora_venda::date) AS amostra,
           avg(v.data_hora_venda::date - p.data_aquisicao)
               FILTER (WHERE p.data_aquisicao <= v.data_hora_venda::date) AS media_dias,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY v.data_hora_venda::date - p.data_aquisicao)
               FILTER (WHERE p.data_aquisicao <= v.data_hora_venda::date) AS mediana_dias
      FROM bi.vw_fato_venda_item v
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
       AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
     GROUP BY p.material
),
t AS (
    SELECT COALESCE(v.material, e.material) AS material,
           COALESCE(v.pecas, 0) AS vendidas,
           COALESCE(e.pecas, 0) AS em_estoque,
           COALESCE(v.amostra, 0) AS amostra,
           v.media_dias, v.mediana_dias
      FROM venda v
      FULL JOIN estoque e ON e.material = v.material
)
SELECT material                                                          AS "Material",
       vendidas::int                                                     AS "Peças vendidas",
       em_estoque::int                                                   AS "Em estoque hoje",
       translate(to_char(100.0 * vendidas / (vendidas + em_estoque), 'FM990.0'), '.', ',') || '%' AS "Taxa de venda",
       amostra::int                                                      AS "Amostra (vendas com data)",
       translate(to_char(media_dias, 'FM99990.0'), '.', ',')             AS "Média de dias até a venda",
       translate(to_char(mediana_dias, 'FM99990.0'), '.', ',')           AS "Mediana de dias até a venda"
  FROM t
 WHERE vendidas + em_estoque > 0
 ORDER BY vendidas::numeric / (vendidas + em_estoque) DESC, vendidas DESC, material;
