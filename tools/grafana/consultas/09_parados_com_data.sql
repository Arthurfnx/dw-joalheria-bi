-- Indicador: produtos parados, os mais antigos primeiro.
-- Hierarquia: Material › Tipo de peça › Produto (código e descrição).
-- Fórmula: Dias parado = data de referência da carga (dia do último retrato do estoque)
--   − data_aquisicao, para cada peça com saldo > 0 no último retrato.
-- Só peças com data de aquisição informada; as demais estão no painel
-- "data de aquisição não informada" (nenhuma data é inventada).
-- Unidades: dias e peças. Ordem: dias parado, do maior para o menor.
WITH ref AS (
    SELECT max(data_key) AS data_key,
           to_date(max(data_key)::text, 'YYYYMMDD') AS data_ref
      FROM bi.vw_fato_snapshot_estoque
)
SELECT p.material                                   AS "Material",
       p.tipo_peca                                  AS "Tipo de peça",
       p.codigo_produto                             AS "Código",
       p.descricao                                  AS "Produto",
       s.quantidade_em_estoque                      AS "Peças",
       to_char(p.data_aquisicao, 'DD/MM/YYYY')      AS "Aquisição",
       (ref.data_ref - p.data_aquisicao)            AS "Dias parado"
  FROM ref
  JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key AND s.quantidade_em_estoque > 0
  JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
 WHERE p.data_aquisicao IS NOT NULL
 ORDER BY ref.data_ref - p.data_aquisicao DESC, p.material, p.tipo_peca, p.codigo_produto;
