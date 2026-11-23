-- Indicador: reposição — proposta (a confirmar com o proprietário).
-- Filtros: Material e Tipo de peça. Ano não se aplica: a regra usa sempre os últimos 12 meses.
-- Fórmulas, por material e tipo de peça:
--   Estoque atual (peças) = Σ quantidade_em_estoque no último retrato;
--   Vendidas em 12 meses (peças) = Σ quantidade_vendida com data da venda nos 12 meses
--     anteriores à data de referência da carga;
--   Cobertura (meses) = estoque atual ÷ (vendidas em 12 meses ÷ 12).
-- Sinal: cobertura abaixo de 3 meses = repor. Sem vendas em 12 meses: cobertura indefinida.
-- Ordem: menor cobertura primeiro.
WITH ref AS (
    SELECT max(data_key) AS data_key,
           to_date(max(data_key)::text, 'YYYYMMDD') AS data_ref
      FROM bi.vw_fato_snapshot_estoque
),
estoque AS (
    SELECT p.material, p.tipo_peca, sum(s.quantidade_em_estoque) AS pecas
      FROM ref
      JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key
      JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
     GROUP BY p.material, p.tipo_peca
),
venda AS (
    SELECT p.material, p.tipo_peca, sum(v.quantidade_vendida) AS pecas
      FROM ref
      JOIN bi.vw_fato_venda_item v
        ON v.data_hora_venda::date >  (ref.data_ref - interval '12 months')::date
       AND v.data_hora_venda::date <= ref.data_ref
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE p.material IN ($material)
       AND p.tipo_peca IN ($tipo_peca)
     GROUP BY p.material, p.tipo_peca
),
t AS (
    SELECT COALESCE(e.material, v.material)   AS material,
           COALESCE(e.tipo_peca, v.tipo_peca) AS tipo_peca,
           COALESCE(e.pecas, 0)               AS estoque,
           COALESCE(v.pecas, 0)               AS vendidas_12m,
           CASE WHEN COALESCE(v.pecas, 0) > 0 THEN COALESCE(e.pecas, 0) / (v.pecas / 12.0) END AS cobertura
      FROM estoque e
      FULL JOIN venda v ON v.material = e.material AND v.tipo_peca = e.tipo_peca
)
SELECT material                                                    AS "Material",
       tipo_peca                                                   AS "Tipo de peça",
       estoque::int                                                AS "Estoque atual",
       vendidas_12m::int                                           AS "Vendidas em 12 meses",
       COALESCE(translate(to_char(cobertura, 'FM99990.0'), '.', ','), '—') AS "Cobertura (meses)",
       CASE WHEN cobertura IS NULL THEN 'Sem vendas em 12 meses'
            WHEN cobertura < 3     THEN 'Repor (abaixo de 3 meses)'
            ELSE 'Cobertura de 3 meses ou mais' END                AS "Situação (proposta)"
  FROM t
 WHERE estoque > 0 OR vendidas_12m > 0
 ORDER BY cobertura ASC NULLS LAST, estoque DESC, material, tipo_peca;
