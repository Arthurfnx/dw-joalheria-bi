-- Indicador: receita faturada por mês.
-- Fórmula: Σ valor_faturado por mês da venda; meses sem venda aparecem com zero,
-- do primeiro ao último mês com venda.
-- Unidade: R$ (reais). Peças ficam em painel separado (nunca no mesmo eixo).
WITH meses AS (
    SELECT generate_series(date_trunc('month', min(data_hora_venda)),
                           date_trunc('month', max(data_hora_venda)),
                           interval '1 month')::date AS mes
      FROM bi.vw_fato_venda_item
)
SELECT (ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[extract(month FROM m.mes)::int]
       || '/' || to_char(m.mes, 'YY')                       AS "Mês",
       COALESCE(sum(v.valor_faturado), 0)::numeric(12,2)     AS "Receita (R$)"
  FROM meses m
  LEFT JOIN bi.vw_fato_venda_item v ON date_trunc('month', v.data_hora_venda)::date = m.mes
 GROUP BY m.mes
 ORDER BY m.mes;
