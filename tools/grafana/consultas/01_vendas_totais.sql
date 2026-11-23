-- Indicador: totais de vendas do período completo (cartões).
-- Fórmulas:
--   Receita faturada (R$) = Σ valor_faturado (sem valor simbólico de R$ 0,01 nem venda sem valor);
--   Peças vendidas (peças) = Σ quantidade_vendida (inclui simbólicas e sem valor);
--   Peças vendidas sem receita (peças) = Σ quantidade_vendida onde entra_faturamento é falso.
-- Vendas canceladas já estão fora do fato. Valores em R$ formatados com vírgula.
SELECT 'R$ ' || translate(to_char(COALESCE(sum(valor_faturado), 0), 'FM999,999,990.00'), ',.', '.,') AS "Receita faturada",
       COALESCE(sum(quantidade_vendida), 0)                                       AS "Peças vendidas",
       COALESCE(sum(quantidade_vendida) FILTER (WHERE NOT entra_faturamento), 0)  AS "Peças vendidas sem receita",
       to_char(min(data_hora_venda), 'MM/YYYY') || ' a ' || to_char(max(data_hora_venda), 'MM/YYYY') AS "Período das vendas"
  FROM bi.vw_fato_venda_item;
