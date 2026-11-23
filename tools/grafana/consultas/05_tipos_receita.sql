-- Indicador: receita faturada por tipo de peça.
-- Fórmula: Σ valor_faturado por dim_produto.tipo_peca (período completo).
-- Unidade: R$ (reais).
SELECT p.tipo_peca                               AS "Tipo de peça",
       COALESCE(sum(v.valor_faturado), 0)::numeric(12,2) AS "Receita (R$)"
  FROM bi.vw_fato_venda_item v
  JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
 GROUP BY p.tipo_peca
 ORDER BY 2 DESC, 1;
