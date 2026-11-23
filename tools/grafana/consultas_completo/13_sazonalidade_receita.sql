-- Indicador: sazonalidade da receita faturada. Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmula: Σ valor_faturado por mês do ano (jan a dez), somando os anos escolhidos.
-- Unidade: R$ (reais). Limitação: cerca de 110 vendas em dois anos; o padrão é
-- indicativo e meses cobertos por mais de um ano pesam mais.
WITH v AS (
    SELECT v.data_hora_venda, v.valor_faturado
      FROM bi.vw_fato_venda_item v
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
       AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
)
SELECT (ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[m.mes] AS "Mês",
       COALESCE(sum(v.valor_faturado), 0)::numeric(12,2)                                   AS "Receita (R$)"
  FROM generate_series(1, 12) AS m(mes)
  LEFT JOIN v ON extract(month FROM v.data_hora_venda)::int = m.mes
 GROUP BY m.mes
 ORDER BY m.mes;
