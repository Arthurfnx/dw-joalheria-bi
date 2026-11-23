-- Indicador: peças vendidas por tipo de peça.
-- Fórmula: Σ quantidade_vendida por dim_produto.tipo_peca (período completo).
-- Unidade: peças.
SELECT p.tipo_peca                       AS "Tipo de peça",
       sum(v.quantidade_vendida)::int    AS "Peças vendidas"
  FROM bi.vw_fato_venda_item v
  JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
 GROUP BY p.tipo_peca
 ORDER BY 2 DESC, 1;
