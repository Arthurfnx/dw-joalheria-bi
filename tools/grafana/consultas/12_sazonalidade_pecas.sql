-- Indicador: sazonalidade das peças vendidas.
-- Fórmula: Σ quantidade_vendida por mês do ano (jan a dez), somando todos os anos.
-- Unidade: peças. Limitação: cerca de 110 vendas em dois anos; o padrão é indicativo
-- e meses cobertos por mais de um ano pesam mais.
SELECT (ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[m.mes] AS "Mês",
       COALESCE(sum(v.quantidade_vendida), 0)::int                                         AS "Peças vendidas"
  FROM generate_series(1, 12) AS m(mes)
  LEFT JOIN bi.vw_fato_venda_item v ON extract(month FROM v.data_hora_venda)::int = m.mes
 GROUP BY m.mes
 ORDER BY m.mes;
