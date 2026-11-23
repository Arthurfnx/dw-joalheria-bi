-- Indicador: peças vendidas por mês. Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmula: Σ quantidade_vendida por mês da venda (inclui vendas simbólicas e sem valor);
-- meses sem venda aparecem com zero, do primeiro ao último mês com venda dentro dos filtros.
-- Unidade: peças.
WITH v AS (
    SELECT v.data_hora_venda, v.quantidade_vendida
      FROM bi.vw_fato_venda_item v
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
       AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
),
meses AS (
    SELECT generate_series(date_trunc('month', min(data_hora_venda)),
                           date_trunc('month', max(data_hora_venda)),
                           interval '1 month')::date AS mes
      FROM v
)
SELECT (ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[extract(month FROM m.mes)::int]
       || '/' || to_char(m.mes, 'YY')                       AS "Mês",
       COALESCE(sum(v.quantidade_vendida), 0)::int            AS "Peças vendidas"
  FROM meses m
  LEFT JOIN v ON date_trunc('month', v.data_hora_venda)::date = m.mes
 GROUP BY m.mes
 ORDER BY m.mes;
