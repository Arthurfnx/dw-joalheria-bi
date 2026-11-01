-- =============================================================================
-- 20_validar_staging.sql — validação dos registros gerados.
-- Toda violação é registrada em audit_demo.rejeicao (nada é descartado em
-- silêncio). As cargas no DW ignoram chaves rejeitadas. Na demo, o esperado é
-- ZERO rejeições: qualquer rejeição indica defeito do gerador.
-- =============================================================================

CREATE OR REPLACE FUNCTION staging_demo.rejeitado(p_exec bigint, p_tabela text, p_chave text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM audit_demo.rejeicao r
                    WHERE r.id_execucao = p_exec AND r.tabela_origem = p_tabela AND r.chave_registro = p_chave)
$$;

CREATE OR REPLACE PROCEDURE staging_demo.validar_staging(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio      timestamptz := clock_timestamp();
    v_ini         date := config_demo.param_data('data_inicio');
    v_fim         date := config_demo.param_data('data_fim');
    v_lidas       bigint;
    v_rejeitadas  bigint;
    v_novas       bigint;
    v_passo       integer := 0;
BEGIN
    -- ---------------------------------------------------------------- produtos
    INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'produto_gerado', v.codigo_produto, v.regra, v.valor
      FROM (
        SELECT codigo_produto, 'CODIGO_FORA_DO_PADRAO' AS regra, codigo_produto::text AS valor
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND codigo_produto !~ '^DEMO-(OURO|PRATA|FOLHADO)-[0-9]{4}$'
        UNION ALL
        SELECT codigo_produto, 'MATERIAL_INVALIDO', coalesce(material, 'NULL')
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND (material IS NULL OR material NOT IN ('Ouro', 'Prata', 'Folheado'))
        UNION ALL
        SELECT codigo_produto, 'PREFIXO_INCOMPATIVEL', material || ' / ' || codigo_produto
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND NOT ((material = 'Ouro' AND codigo_produto LIKE 'DEMO-OURO-%')
                 OR (material = 'Prata' AND codigo_produto LIKE 'DEMO-PRATA-%')
                 OR (material = 'Folheado' AND codigo_produto LIKE 'DEMO-FOLHADO-%'))
        UNION ALL
        SELECT p.codigo_produto, 'TIPO_PECA_INVALIDO', coalesce(p.tipo_peca, 'NULL')
          FROM staging_demo.produto_gerado p WHERE p.id_execucao = p_exec
           AND NOT EXISTS (SELECT 1 FROM config_demo.tipo_peca t WHERE t.tipo_peca = p.tipo_peca)
        UNION ALL
        SELECT codigo_produto, 'DESCRICAO_AUSENTE', NULL
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND (descricao IS NULL OR btrim(descricao) = '')
        UNION ALL
        SELECT codigo_produto, 'OURO_SEM_PESO', coalesce(peso_g::text, 'NULL')
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND material = 'Ouro' AND (peso_g IS NULL OR peso_g <= 0)
        UNION ALL
        SELECT codigo_produto, 'FOLHEADO_COM_PESO', peso_g::text
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND material = 'Folheado' AND peso_g IS NOT NULL
        UNION ALL
        SELECT codigo_produto, 'PESO_NAO_POSITIVO', peso_g::text
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND peso_g IS NOT NULL AND peso_g <= 0
        UNION ALL
        SELECT codigo_produto, 'ANEL_SEM_TAMANHO', NULL
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND tipo_peca = 'Anel' AND tamanho IS NULL
        UNION ALL
        SELECT codigo_produto, 'OURO_TAMANHO_FORA_DE_ANEL', tipo_peca || ' / ' || tamanho
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND material = 'Ouro' AND tipo_peca <> 'Anel' AND tamanho IS NOT NULL
        UNION ALL
        SELECT codigo_produto, 'INDICE_INVALIDO', coalesce(indice_precificacao::text, 'NULL')
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND (indice_precificacao IS NULL OR indice_precificacao <= 0)
        UNION ALL
        SELECT codigo_produto, 'ORIGEM_INVALIDA', origem_dado
          FROM staging_demo.produto_gerado WHERE id_execucao = p_exec
           AND origem_dado <> 'SINTETICO_DEMO'
      ) v
    ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;

    -- ---------------------------------------------------------- preço do ouro
    INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'preco_ouro_gerado', v.chave, v.regra, v.valor
      FROM (
        SELECT data_referencia::text AS chave, 'PRECO_INVALIDO' AS regra, coalesce(preco_ouro_1000::text, 'NULL') AS valor
          FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec
           AND (preco_ouro_1000 IS NULL OR preco_ouro_1000 <= 0)
        UNION ALL
        SELECT data_referencia::text, 'UNIDADE_INVALIDA', coalesce(unidade_referencia, 'NULL')
          FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec
           AND unidade_referencia IS DISTINCT FROM 'NAO_CONFIRMADA_DEMO'
        UNION ALL
        SELECT data_referencia::text, 'DATA_FORA_DO_PERIODO', data_referencia::text
          FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec
           AND data_referencia NOT BETWEEN v_ini AND v_fim
        UNION ALL
        SELECT g.d::date::text, 'DIA_SEM_PRECO', NULL
          FROM generate_series(v_ini::timestamp, v_fim::timestamp, interval '1 day') AS g(d)
         WHERE NOT EXISTS (SELECT 1 FROM staging_demo.preco_ouro_gerado s
                            WHERE s.id_execucao = p_exec AND s.data_referencia = g.d::date)
      ) v
    ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;

    -- ------------------------------------------------------- entradas (compras)
    INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'entrada_gerada', v.chave, v.regra, v.valor
      FROM (
        SELECT e.id_evento_origem AS chave, 'PRODUTO_INVALIDO' AS regra, e.codigo_produto::text AS valor
          FROM staging_demo.entrada_gerada e WHERE e.id_execucao = p_exec
           AND (NOT EXISTS (SELECT 1 FROM staging_demo.produto_gerado p
                             WHERE p.id_execucao = p_exec AND p.codigo_produto = e.codigo_produto)
                OR staging_demo.rejeitado(p_exec, 'produto_gerado', e.codigo_produto))
        UNION ALL
        SELECT id_evento_origem, 'QUANTIDADE_INVALIDA', coalesce(quantidade_recebida::text, 'NULL')
          FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec
           AND (quantidade_recebida IS NULL OR quantidade_recebida <= 0)
        UNION ALL
        SELECT id_evento_origem, 'CUSTO_INVALIDO', coalesce(custo_total_pago::text, 'NULL')
          FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec
           AND (custo_total_pago IS NULL OR custo_total_pago <= 0)
        UNION ALL
        SELECT id_evento_origem, 'INDICE_INVALIDO', coalesce(indice_aplicado::text, 'NULL')
          FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec
           AND (indice_aplicado IS NULL OR indice_aplicado <= 0)
        UNION ALL
        SELECT id_evento_origem, 'PRECO_MARCADO_INVALIDO', coalesce(preco_venda_marcado_unitario::text, 'NULL')
          FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec
           AND (preco_venda_marcado_unitario IS NULL OR preco_venda_marcado_unitario <= 0)
        UNION ALL
        SELECT id_evento_origem, 'DATA_FORA_DO_PERIODO', data_hora_entrada::text
          FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec
           AND data_hora_entrada::date NOT BETWEEN v_ini AND v_fim
        UNION ALL
        -- Ouro/Prata exigem preço do ouro VÁLIDO da MESMA data (sem fallback).
        SELECT e.id_evento_origem, 'SEM_PRECO_OURO_MESMA_DATA', e.data_hora_entrada::date::text
          FROM staging_demo.entrada_gerada e
          JOIN staging_demo.produto_gerado p ON p.id_execucao = e.id_execucao AND p.codigo_produto = e.codigo_produto
         WHERE e.id_execucao = p_exec
           AND p.material IN ('Ouro', 'Prata')
           AND NOT EXISTS (SELECT 1 FROM staging_demo.preco_ouro_gerado s
                            WHERE s.id_execucao = p_exec
                              AND s.data_referencia = e.data_hora_entrada::date
                              AND s.preco_ouro_1000 > 0
                              AND NOT staging_demo.rejeitado(p_exec, 'preco_ouro_gerado', s.data_referencia::text))
        UNION ALL
        SELECT e.id_evento_origem, 'MOVIMENTO_AUSENTE_OU_DIVERGENTE', NULL
          FROM staging_demo.entrada_gerada e
         WHERE e.id_execucao = p_exec
           AND NOT EXISTS (SELECT 1 FROM staging_demo.movimento_gerado m
                            WHERE m.id_execucao = p_exec AND m.id_evento_origem = e.id_evento_origem
                              AND m.codigo_tipo = 'ENTRADA_COMPRA' AND m.codigo_produto = e.codigo_produto
                              AND m.data_hora_evento = e.data_hora_entrada
                              AND m.quantidade IS NOT DISTINCT FROM e.quantidade_recebida)
      ) v
    ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;

    -- ------------------------------------------------------------ itens de venda
    INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'venda_gerada', v.chave, v.regra, v.valor
      FROM (
        SELECT e.id_evento_origem AS chave, 'PRODUTO_INVALIDO' AS regra, e.codigo_produto::text AS valor
          FROM staging_demo.venda_gerada e WHERE e.id_execucao = p_exec
           AND (NOT EXISTS (SELECT 1 FROM staging_demo.produto_gerado p
                             WHERE p.id_execucao = p_exec AND p.codigo_produto = e.codigo_produto)
                OR staging_demo.rejeitado(p_exec, 'produto_gerado', e.codigo_produto))
        UNION ALL
        SELECT id_evento_origem, 'QUANTIDADE_INVALIDA', coalesce(quantidade_vendida::text, 'NULL')
          FROM staging_demo.venda_gerada WHERE id_execucao = p_exec
           AND (quantidade_vendida IS NULL OR quantidade_vendida <= 0)
        UNION ALL
        SELECT id_evento_origem, 'PRECO_MARCADO_INVALIDO', coalesce(preco_venda_marcado_unitario::text, 'NULL')
          FROM staging_demo.venda_gerada WHERE id_execucao = p_exec
           AND (preco_venda_marcado_unitario IS NULL OR preco_venda_marcado_unitario <= 0)
        UNION ALL
        SELECT id_evento_origem, 'PRECO_REALIZADO_INVALIDO', coalesce(preco_vendido_realizado_unitario::text, 'NULL')
          FROM staging_demo.venda_gerada WHERE id_execucao = p_exec
           AND (preco_vendido_realizado_unitario IS NULL OR preco_vendido_realizado_unitario <= 0)
        UNION ALL
        SELECT id_evento_origem, 'DATA_FORA_DO_PERIODO', data_hora_venda::text
          FROM staging_demo.venda_gerada WHERE id_execucao = p_exec
           AND data_hora_venda::date NOT BETWEEN v_ini AND v_fim
        UNION ALL
        SELECT e.id_evento_origem, 'MOVIMENTO_AUSENTE_OU_DIVERGENTE', NULL
          FROM staging_demo.venda_gerada e
         WHERE e.id_execucao = p_exec
           AND NOT EXISTS (SELECT 1 FROM staging_demo.movimento_gerado m
                            WHERE m.id_execucao = p_exec AND m.id_evento_origem = e.id_evento_origem
                              AND m.codigo_tipo = 'SAIDA_VENDA' AND m.codigo_produto = e.codigo_produto
                              AND m.data_hora_evento = e.data_hora_venda
                              AND m.quantidade IS NOT DISTINCT FROM e.quantidade_vendida)
      ) v
    ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;

    -- -------------------------------------------------------------- movimentos
    INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'movimento_gerado', v.chave, v.regra, v.valor
      FROM (
        SELECT m.id_evento_origem AS chave, 'PRODUTO_INVALIDO' AS regra, m.codigo_produto::text AS valor
          FROM staging_demo.movimento_gerado m WHERE m.id_execucao = p_exec
           AND (NOT EXISTS (SELECT 1 FROM staging_demo.produto_gerado p
                             WHERE p.id_execucao = p_exec AND p.codigo_produto = m.codigo_produto)
                OR staging_demo.rejeitado(p_exec, 'produto_gerado', m.codigo_produto))
        UNION ALL
        SELECT id_evento_origem, 'QUANTIDADE_INVALIDA', coalesce(quantidade::text, 'NULL')
          FROM staging_demo.movimento_gerado WHERE id_execucao = p_exec
           AND (quantidade IS NULL OR quantidade <= 0)
        UNION ALL
        SELECT m.id_evento_origem, 'TIPO_INVALIDO', m.codigo_tipo::text
          FROM staging_demo.movimento_gerado m WHERE m.id_execucao = p_exec
           AND NOT EXISTS (SELECT 1 FROM dw_demo.dim_tipo_movimentacao t WHERE t.codigo_tipo = m.codigo_tipo)
        UNION ALL
        SELECT id_evento_origem, 'DATA_FORA_DO_PERIODO', data_hora_evento::text
          FROM staging_demo.movimento_gerado WHERE id_execucao = p_exec
           AND data_hora_evento::date NOT BETWEEN v_ini AND v_fim
        UNION ALL
        SELECT m.id_evento_origem, 'VENDA_SEM_ITEM_COMERCIAL', NULL
          FROM staging_demo.movimento_gerado m WHERE m.id_execucao = p_exec AND m.codigo_tipo = 'SAIDA_VENDA'
           AND NOT EXISTS (SELECT 1 FROM staging_demo.venda_gerada v2
                            WHERE v2.id_execucao = p_exec AND v2.id_evento_origem = m.id_evento_origem)
        UNION ALL
        SELECT m.id_evento_origem, 'COMPRA_SEM_ITEM_COMERCIAL', NULL
          FROM staging_demo.movimento_gerado m WHERE m.id_execucao = p_exec AND m.codigo_tipo = 'ENTRADA_COMPRA'
           AND NOT EXISTS (SELECT 1 FROM staging_demo.entrada_gerada e2
                            WHERE e2.id_execucao = p_exec AND e2.id_evento_origem = m.id_evento_origem)
      ) v
    ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;

    -- -------------------------------------------- rejeição em cascata (pares)
    -- Item comercial rejeitado => movimento correspondente rejeitado, e vice-versa.
    LOOP
        v_passo := v_passo + 1;

        INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
        SELECT p_exec, 'movimento_gerado', m.id_evento_origem, 'ITEM_COMERCIAL_REJEITADO', NULL
          FROM staging_demo.movimento_gerado m
         WHERE m.id_execucao = p_exec
           AND m.codigo_tipo IN ('SAIDA_VENDA', 'ENTRADA_COMPRA')
           AND (staging_demo.rejeitado(p_exec, 'venda_gerada', m.id_evento_origem)
                OR staging_demo.rejeitado(p_exec, 'entrada_gerada', m.id_evento_origem))
        ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;
        GET DIAGNOSTICS v_novas = ROW_COUNT;

        INSERT INTO audit_demo.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
        SELECT p_exec, x.tabela, x.chave, 'MOVIMENTO_REJEITADO', NULL
          FROM (SELECT 'venda_gerada'::text AS tabela, v.id_evento_origem AS chave
                  FROM staging_demo.venda_gerada v WHERE v.id_execucao = p_exec
                UNION ALL
                SELECT 'entrada_gerada'::text, e.id_evento_origem
                  FROM staging_demo.entrada_gerada e WHERE e.id_execucao = p_exec) x
         WHERE staging_demo.rejeitado(p_exec, 'movimento_gerado', x.chave)
           AND NOT EXISTS (SELECT 1 FROM audit_demo.rejeicao r
                            WHERE r.id_execucao = p_exec AND r.tabela_origem = x.tabela AND r.chave_registro = x.chave)
        ON CONFLICT ON CONSTRAINT uq_rejeicao DO NOTHING;
        GET DIAGNOSTICS v_lidas = ROW_COUNT;

        EXIT WHEN (v_novas + v_lidas) = 0 OR v_passo >= 5;
    END LOOP;

    SELECT (SELECT count(*) FROM staging_demo.produto_gerado    WHERE id_execucao = p_exec)
         + (SELECT count(*) FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec)
         + (SELECT count(*) FROM staging_demo.entrada_gerada    WHERE id_execucao = p_exec)
         + (SELECT count(*) FROM staging_demo.venda_gerada      WHERE id_execucao = p_exec)
         + (SELECT count(*) FROM staging_demo.movimento_gerado  WHERE id_execucao = p_exec)
      INTO v_lidas;
    SELECT count(DISTINCT (tabela_origem, chave_registro)) INTO v_rejeitadas
      FROM audit_demo.rejeicao WHERE id_execucao = p_exec;

    CALL audit_demo.registrar_etapa(p_exec, 'validar_staging', v_inicio, v_lidas, v_lidas - v_rejeitadas, v_rejeitadas,
        CASE WHEN v_rejeitadas = 0 THEN 'Nenhuma rejeição.'
             ELSE 'ATENÇÃO: há rejeições; consulte audit_demo.rejeicao.' END);
END;
$$;
