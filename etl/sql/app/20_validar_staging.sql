-- =============================================================================
-- 20_validar_staging.sql — esvaziamento e validação da staging do DW real.
--
-- staging.esvaziar(): recarga completa (autorizada para staging, dw e bi).
-- staging.validar_staging(exec): grava em audit.rejeicao cada registro que
-- não pode ir ao DW, com a regra violada. Nada é descartado em silêncio: as
-- cargas (30_carregar_dw.sql) só leem registros sem rejeição nesta execução
-- e as contagens lidas/carregadas/rejeitadas ficam em audit.etapa.
-- A chave registrada é o id técnico do banco operacional; valor_observado
-- nunca traz descrição nem texto livre.
-- =============================================================================

CREATE OR REPLACE PROCEDURE staging.esvaziar()
LANGUAGE plpgsql
AS $$
BEGIN
    TRUNCATE TABLE
        staging.produto,
        staging.tipo_movimentacao,
        staging.venda,
        staging.venda_item,
        staging.venda_historica,
        staging.preco_ouro,
        staging.movimentacao_estoque,
        staging.saldo_estoque,
        staging.importacao_lote,
        staging.configuracao,
        staging.extracao;
END;
$$;

-- Registro (tabela, id) rejeitado nesta execução?
CREATE OR REPLACE FUNCTION staging.rejeitado(p_exec bigint, p_tabela text, p_id bigint)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM audit.rejeicao r
                    WHERE r.id_execucao = p_exec AND r.tabela_origem = p_tabela
                      AND r.chave_registro = 'id=' || coalesce(p_id::text, 'NULL'))
$$;

CREATE OR REPLACE PROCEDURE staging.validar_staging(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio  timestamptz := clock_timestamp();
    v_ref     date;
    v_n       bigint;
BEGIN
    SELECT max(data_referencia) INTO v_ref FROM staging.extracao;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION 'staging.extracao vazia: a extração do banco operacional não foi carregada.';
    END IF;

    -- tipo_movimentacao ---------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'tipo_movimentacao', 'codigo=' || coalesce(codigo, 'NULL'), 'TIP_CAMPOS', format('sinal=%s', sinal)
      FROM staging.tipo_movimentacao
     WHERE codigo IS NULL OR btrim(codigo) = '' OR sinal IS NULL OR sinal NOT IN (-1, 1)
        OR eh_venda IS NULL OR coalesce(btrim(descricao), '') = ''
    ON CONFLICT DO NOTHING;

    -- produto -------------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'produto', 'id=' || coalesce(id::text, 'NULL'), regra, obs
      FROM (
            SELECT id, 'PRD_OBRIGATORIO' AS regra, 'código, descrição, material, categoria ou modo de controle vazio' AS obs
              FROM staging.produto
             WHERE id IS NULL OR coalesce(btrim(codigo), '') = '' OR coalesce(btrim(descricao), '') = ''
                OR coalesce(btrim(material), '') = '' OR coalesce(btrim(categoria), '') = '' OR modo_controle IS NULL
                OR ativo IS NULL OR criado_em IS NULL
            UNION ALL
            SELECT id, 'PRD_ID_DUPLICADO', format('id repetido %s vezes', count(*) OVER (PARTITION BY id))
              FROM staging.produto
             WHERE id IN (SELECT id FROM staging.produto GROUP BY id HAVING count(*) > 1)
            UNION ALL
            SELECT id, 'PRD_CODIGO_DUPLICADO', 'código repetido em outro produto'
              FROM staging.produto
             WHERE codigo IN (SELECT codigo FROM staging.produto GROUP BY codigo HAVING count(*) > 1)
            UNION ALL
            SELECT id, 'PRD_MODO_CONTROLE', format('modo=%s', modo_controle)
              FROM staging.produto
             WHERE modo_controle NOT IN ('UNITARIO', 'QUANTIDADE')
            UNION ALL
            SELECT id, 'PRD_VALOR_INVALIDO', format('peso=%s; indice=%s; preco=%s; aquisicao=%s', peso_gramas, indice_preco, preco_venda, valor_aquisicao)
              FROM staging.produto
             WHERE peso_gramas <= 0 OR indice_preco <= 0 OR preco_venda < 0 OR valor_aquisicao < 0
                OR preco_sugerido_atual < 0 OR preco_sugerido_aquisicao < 0
            UNION ALL
            SELECT id, 'PRD_DATA_FUTURA', format('data_aquisicao=%s; referencia=%s', data_aquisicao, v_ref)
              FROM staging.produto
             WHERE data_aquisicao > v_ref
           ) r
    ON CONFLICT DO NOTHING;

    -- venda -----------------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'venda', 'id=' || coalesce(id::text, 'NULL'), regra, obs
      FROM (
            SELECT id, 'VDA_OBRIGATORIO' AS regra, format('numero=%s; data=%s; situacao=%s', numero, data_venda, situacao) AS obs
              FROM staging.venda
             WHERE id IS NULL OR numero IS NULL OR data_venda IS NULL
                OR situacao IS NULL OR situacao NOT IN ('CONFIRMADA', 'CANCELADA')
            UNION ALL
            SELECT id, 'VDA_DUPLICADA', format('numero=%s', numero)
              FROM staging.venda
             WHERE id IN (SELECT id FROM staging.venda GROUP BY id HAVING count(*) > 1)
                OR numero IN (SELECT numero FROM staging.venda GROUP BY numero HAVING count(*) > 1)
            UNION ALL
            SELECT id, 'VDA_DATA_FUTURA', format('data=%s; referencia=%s', data_venda, v_ref)
              FROM staging.venda
             WHERE data_venda > v_ref
           ) r
    ON CONFLICT DO NOTHING;

    -- venda_item --------------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'venda_item', 'id=' || coalesce(i.id::text, 'NULL'), r.regra, r.obs
      FROM staging.venda_item i
     CROSS JOIN LATERAL (
            SELECT 'VIT_OBRIGATORIO' AS regra, format('quantidade=%s; preco=%s', i.quantidade, i.preco_praticado) AS obs
             WHERE i.id IS NULL OR i.quantidade IS NULL OR i.quantidade <= 0
                OR i.preco_praticado IS NULL OR i.preco_praticado < 0 OR i.preco_tabela < 0
            UNION ALL
            SELECT 'VIT_VENDA_INVALIDA', format('venda_id=%s', i.venda_id)
             WHERE NOT EXISTS (SELECT 1 FROM staging.venda v WHERE v.id = i.venda_id)
                OR staging.rejeitado(p_exec, 'venda', i.venda_id)
            UNION ALL
            SELECT 'VIT_PRODUTO_INVALIDO', format('produto_id=%s', i.produto_id)
             WHERE NOT EXISTS (SELECT 1 FROM staging.produto p WHERE p.id = i.produto_id)
                OR staging.rejeitado(p_exec, 'produto', i.produto_id)
            UNION ALL
            SELECT 'VIT_DUPLICADO', format('id=%s', i.id)
             WHERE (SELECT count(*) FROM staging.venda_item x WHERE x.id = i.id) > 1
           ) r
    ON CONFLICT DO NOTHING;

    -- venda_historica ---------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'venda_historica', 'id=' || coalesce(h.id::text, 'NULL'), r.regra, r.obs
      FROM staging.venda_historica h
     CROSS JOIN LATERAL (
            SELECT 'VHI_OBRIGATORIO' AS regra, format('data=%s; valor=%s; simbolico=%s', h.data_venda, h.valor_venda, h.simbolico) AS obs
             WHERE h.id IS NULL OR h.data_venda IS NULL OR h.simbolico IS NULL
                OR h.valor_venda < 0 OR h.valor_compra < 0 OR h.data_venda > v_ref
            UNION ALL
            SELECT 'VHI_PRODUTO_INVALIDO', format('produto_id=%s', h.produto_id)
             WHERE NOT EXISTS (SELECT 1 FROM staging.produto p WHERE p.id = h.produto_id)
                OR staging.rejeitado(p_exec, 'produto', h.produto_id)
            UNION ALL
            SELECT 'VHI_DUPLICADO', format('id=%s', h.id)
             WHERE (SELECT count(*) FROM staging.venda_historica x WHERE x.id = h.id) > 1
           ) r
    ON CONFLICT DO NOTHING;

    -- preco_ouro --------------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'preco_ouro', 'id=' || coalesce(id::text, 'NULL'), 'OUR_CAMPOS',
           format('valor=%s; vigente_desde=%s', valor_grama, vigente_desde)
      FROM staging.preco_ouro
     WHERE id IS NULL OR valor_grama IS NULL OR valor_grama <= 0 OR vigente_desde IS NULL OR registrado_em IS NULL
        OR id IN (SELECT id FROM staging.preco_ouro GROUP BY id HAVING count(*) > 1)
    ON CONFLICT DO NOTHING;

    -- movimentacao_estoque ------------------------------------------------------------
    INSERT INTO audit.rejeicao (id_execucao, tabela_origem, chave_registro, regra, valor_observado)
    SELECT p_exec, 'movimentacao_estoque', 'id=' || coalesce(m.id::text, 'NULL'), r.regra, r.obs
      FROM staging.movimentacao_estoque m
     CROSS JOIN LATERAL (
            SELECT 'MOV_OBRIGATORIO' AS regra,
                   format('quantidade=%s; saldo_apos=%s; data=%s', m.quantidade, m.saldo_apos, m.data_ocorrencia) AS obs
             WHERE m.id IS NULL OR m.quantidade IS NULL OR m.quantidade <= 0 OR m.saldo_apos IS NULL OR m.saldo_apos < 0
                OR m.data_ocorrencia IS NULL OR m.data_ocorrencia > v_ref OR m.registrada_em IS NULL OR m.custo_unitario < 0
            UNION ALL
            SELECT 'MOV_TIPO_INVALIDO', format('tipo=%s', m.tipo_codigo)
             WHERE NOT EXISTS (SELECT 1 FROM staging.tipo_movimentacao t WHERE t.codigo = m.tipo_codigo)
                OR EXISTS (SELECT 1 FROM audit.rejeicao r2 WHERE r2.id_execucao = p_exec
                             AND r2.tabela_origem = 'tipo_movimentacao' AND r2.chave_registro = 'codigo=' || m.tipo_codigo)
            UNION ALL
            SELECT 'MOV_PRODUTO_INVALIDO', format('produto_id=%s', m.produto_id)
             WHERE NOT EXISTS (SELECT 1 FROM staging.produto p WHERE p.id = m.produto_id)
                OR staging.rejeitado(p_exec, 'produto', m.produto_id)
            UNION ALL
            SELECT 'MOV_DUPLICADA', format('id=%s', m.id)
             WHERE (SELECT count(*) FROM staging.movimentacao_estoque x WHERE x.id = m.id) > 1
           ) r
    ON CONFLICT DO NOTHING;

    SELECT count(*) INTO v_n FROM audit.rejeicao WHERE id_execucao = p_exec;
    CALL audit.registrar_etapa(p_exec, 'validar_staging', NULL, v_inicio, NULL, NULL, v_n,
        format('%s rejeição(ões) registrada(s) em audit.rejeicao; data de referência %s', v_n, v_ref));
END;
$$;
