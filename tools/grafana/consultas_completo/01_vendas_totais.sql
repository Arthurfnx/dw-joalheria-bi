-- Indicador: totais de vendas (cartões). Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmulas:
--   Receita faturada (R$) = Σ valor_faturado (sem valor simbólico de R$ 0,01 nem venda sem valor);
--   Peças vendidas (peças) = Σ quantidade_vendida (inclui simbólicas e sem valor);
--   Peças vendidas sem receita (peças) = Σ quantidade_vendida onde entra_faturamento é falso.
-- Vendas canceladas já estão fora do fato. Valores em R$ formatados com vírgula.
SELECT 'R$ ' || translate(to_char(COALESCE(sum(v.valor_faturado), 0), 'FM999,999,990.00'), ',.', '.,') AS "Receita faturada",
       COALESCE(sum(v.quantidade_vendida), 0)                                        AS "Peças vendidas",
       COALESCE(sum(v.quantidade_vendida) FILTER (WHERE NOT v.entra_faturamento), 0) AS "Peças vendidas sem receita",
       COALESCE(to_char(min(v.data_hora_venda), 'MM/YYYY') || ' a ' || to_char(max(v.data_hora_venda), 'MM/YYYY'), '—') AS "Período das vendas"
  FROM bi.vw_fato_venda_item v
  JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
 WHERE p.material IN ($material)
   AND p.tipo_peca IN ($tipo_peca)
   AND to_char(v.data_hora_venda, 'YYYY') IN ($ano);
