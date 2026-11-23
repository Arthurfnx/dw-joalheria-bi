-- Indicador: receita faturada por tipo de peça. Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmula: Σ valor_faturado por dim_produto.tipo_peca.
-- Unidade: R$ (reais).
SELECT p.tipo_peca                                       AS "Tipo de peça",
       COALESCE(sum(v.valor_faturado), 0)::numeric(12,2) AS "Receita (R$)"
  FROM bi.vw_fato_venda_item v
  JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
 WHERE p.material IN ($material)
   AND p.tipo_peca IN ($tipo_peca)
   AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
 GROUP BY p.tipo_peca
 ORDER BY 2 DESC, 1;
