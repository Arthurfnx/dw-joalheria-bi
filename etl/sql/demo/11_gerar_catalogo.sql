-- =============================================================================
-- 11_gerar_catalogo.sql — catálogo SINTÉTICO (DEMO-<MATERIAL>-NNNN) e perfis
-- técnicos de movimentação. Nada é copiado das planilhas reais.
--
-- Tipo de peça: alocação proporcional DETERMINÍSTICA pelos pesos de
--   config_demo.distribuicao_tipo (o i-ésimo produto recebe o tipo cuja faixa
--   acumulada contém (i - 0,5) / N).
-- Tamanho: somente para tipos com exige_tamanho; em Ouro, somente para Anel.
-- Peso: somente Ouro (faixa por tipo de peça). Prata e Folheado: NULL.
-- Índice: Ouro = peso × fator por grama; Prata/Folheado = faixa do material.
-- Perfil: embaralhamento determinístico por material + cotas por proporção.
-- =============================================================================

CREATE OR REPLACE PROCEDURE staging_demo.gerar_catalogo(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sem bigint := config_demo.param_inteiro('semente');
BEGIN
    INSERT INTO staging_demo.produto_gerado
        (id_execucao, codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
    WITH seq AS (
        SELECT m.material, m.prefixo_codigo, m.qtd_produtos, m.indice_min, m.indice_max, g.i
          FROM config_demo.material m
         CROSS JOIN LATERAL generate_series(1, m.qtd_produtos) AS g(i)
         WHERE m.qtd_produtos > 0
    ),
    dist AS (
        SELECT d.material, d.tipo_peca,
               sum(d.peso) OVER (PARTITION BY d.material ORDER BY d.tipo_peca COLLATE "C"
                                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acumulado,
               sum(d.peso) OVER (PARTITION BY d.material) AS total
          FROM config_demo.distribuicao_tipo d
         WHERE d.peso > 0
    ),
    atrib AS (
        SELECT s.*,
               'DEMO-' || s.prefixo_codigo || '-' || lpad(s.i::text, 4, '0') AS codigo,
               (SELECT x.tipo_peca
                  FROM dist x
                 WHERE x.material = s.material
                   AND x.acumulado / x.total >= (s.i - 0.5) / s.qtd_produtos
                 ORDER BY x.acumulado
                 LIMIT 1) AS tipo_peca
          FROM seq s
    ),
    com_peso AS (
        SELECT a.*, t.exige_tamanho, t.tamanho_min, t.tamanho_max,
               CASE WHEN a.material = 'Ouro'
                    THEN round(config_demo.rand_entre(v_sem, 'peso|' || a.codigo, 0, t.peso_ouro_min_g, t.peso_ouro_max_g), 3)
               END AS peso_g
          FROM atrib a
          JOIN config_demo.tipo_peca t ON t.tipo_peca = a.tipo_peca
    )
    SELECT p_exec,
           c.codigo,
           c.tipo_peca || ' ' || c.material || ' DEMO ' || lpad(c.i::text, 4, '0'),
           c.material,
           c.tipo_peca,
           CASE WHEN c.exige_tamanho AND (c.material <> 'Ouro' OR c.tipo_peca = 'Anel')
                THEN config_demo.rand_int(v_sem, 'tamanho|' || c.codigo, 0, c.tamanho_min, c.tamanho_max)::text
           END,
           c.peso_g,
           CASE WHEN c.material = 'Ouro'
                THEN round(c.peso_g * config_demo.rand_entre(v_sem, 'indice|' || c.codigo, 0, c.indice_min, c.indice_max), 4)
                ELSE round(config_demo.rand_entre(v_sem, 'indice|' || c.codigo, 0, c.indice_min, c.indice_max), 4)
           END
      FROM com_peso c;

    -- Perfis técnicos e saldo inicial.
    INSERT INTO staging_demo.produto_perfil_simulacao (id_execucao, codigo_produto, perfil_movimentacao_demo, saldo_inicial)
    WITH ordenado AS (
        SELECT p.codigo_produto, p.material,
               row_number() OVER (PARTITION BY p.material
                                  ORDER BY config_demo.rand_det(v_sem, 'perfil|' || p.codigo_produto, 0), p.codigo_produto COLLATE "C") AS pos,
               count(*) OVER (PARTITION BY p.material) AS n
          FROM staging_demo.produto_gerado p
         WHERE p.id_execucao = p_exec
    ),
    faixas AS (
        SELECT perfil,
               sum(proporcao) OVER (ORDER BY ordem ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acumulado,
               ordem
          FROM config_demo.perfil_movimentacao
    )
    SELECT p_exec,
           o.codigo_produto,
           coalesce((SELECT f.perfil FROM faixas f
                      WHERE f.acumulado >= (o.pos - 0.5) / o.n
                      ORDER BY f.ordem LIMIT 1),
                    (SELECT perfil FROM config_demo.perfil_movimentacao ORDER BY ordem DESC LIMIT 1)),
           config_demo.rand_int(v_sem, 'saldo_inicial|' || o.codigo_produto, 0, m.saldo_inicial_min, m.saldo_inicial_max)
      FROM ordenado o
      JOIN config_demo.material m ON m.material = o.material;
END;
$$;
