-- Indicador: peças vendidas por tipo de peça. Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmula: Σ quantidade_vendida por dim_produto.tipo_peca.
-- Unidade: peças.
SELECT p.tipo_peca                       AS "Tipo de peça",
       sum(v.quantidade_vendida)::int    AS "Peças vendidas"
  FROM bi.vw_fato_venda_item v
  JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
 WHERE p.material IN ($material)
   AND p.tipo_peca IN ($tipo_peca)
   AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
 GROUP BY p.tipo_peca
 ORDER BY 2 DESC, 1;
