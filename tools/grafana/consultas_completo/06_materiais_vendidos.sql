-- Indicador: vendas por material. Filtros: Material, Tipo de peça e Ano da venda.
-- Fórmulas: Peças vendidas = Σ quantidade_vendida; Receita = Σ valor_faturado;
-- % das peças = peças do material ÷ total de peças vendidas dentro dos filtros.
-- Unidades: peças, R$ e %.
WITH t AS (
    SELECT p.material,
           sum(v.quantidade_vendida)            AS pecas,
           COALESCE(sum(v.valor_faturado), 0)   AS receita
      FROM bi.vw_fato_venda_item v
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
       AND to_char(v.data_hora_venda, 'YYYY') IN ($ano)
     GROUP BY p.material
)
SELECT material                                                                        AS "Material",
       pecas::int                                                                      AS "Peças vendidas",
       'R$ ' || translate(to_char(receita, 'FM999,999,990.00'), ',.', '.,')            AS "Receita",
       translate(to_char(100.0 * pecas / sum(pecas) OVER (), 'FM990.0'), '.', ',') || '%' AS "% das peças"
  FROM t
 ORDER BY pecas DESC, material;
