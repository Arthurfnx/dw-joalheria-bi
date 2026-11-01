-- =============================================================================
-- 03_preco_ouro.sql — fórmula do preço sugerido e versionamento do preço do ouro
-- (PRC-01..PRC-05). As correções são testadas e DESFEITAS com ROLLBACK.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n           integer;
    v_data        date;
    v_param_v1    bigint;
    v_valor_v1    numeric;
    v_compras_md5 text;
    v_param_v2    dw_demo.parametro_preco_ouro%ROWTYPE;
BEGIN
    -- Fórmula (regra confirmada).
    IF dw_demo.calcular_preco_sugerido(400.00, 2.5) <> 1600.00 THEN
        RAISE EXCEPTION 'FALHA [PRC-00]: 400 × 1,6 × 2,5 deveria ser 1600,00';
    END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_data d
     WHERE NOT EXISTS (SELECT 1 FROM dw_demo.parametro_preco_ouro p WHERE p.data_referencia = d.data AND p.vigente);
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [PRC-01a]: % dia(s) sem preço vigente', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.parametro_preco_ouro WHERE unidade_referencia <> 'NAO_CONFIRMADA_DEMO';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [PRC-01b]: unidade diferente de NAO_CONFIRMADA_DEMO'; END IF;

    SELECT count(*) INTO v_n
      FROM dw_demo.fato_compra_item c
      JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
      LEFT JOIN dw_demo.parametro_preco_ouro pp ON pp.parametro_id = c.parametro_preco_ouro_id
     WHERE (p.material IN ('Ouro', 'Prata') AND (pp.parametro_id IS NULL OR pp.data_referencia <> c.data_hora_entrada::date))
        OR (p.material = 'Folheado' AND (c.parametro_preco_ouro_id IS NOT NULL OR c.preco_sugerido_unitario IS NOT NULL));
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [PRC-02]: % compra(s) com vínculo de preço inválido', v_n; END IF;

    SELECT count(*) INTO v_n
      FROM dw_demo.fato_compra_item c
      JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
     WHERE p.material IN ('Ouro', 'Prata')
       AND c.preco_sugerido_unitario <> round(c.preco_ouro_1000_aplicado * 1.6 * c.indice_aplicado, 2);
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [PRC-03]: % preço(s) sugerido(s) fora da fórmula', v_n; END IF;

    IF NOT EXISTS (SELECT 1 FROM dw_demo.fato_compra_item c JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
                    WHERE p.material = 'Ouro') THEN
        RAISE EXCEPTION 'FALHA [PRC-03b]: nenhuma compra de Ouro gerada para testar a correção';
    END IF;

    -- Escolhe uma data com compra de Ouro para testar a correção.
    SELECT c.data_hora_entrada::date, c.parametro_preco_ouro_id, c.preco_ouro_1000_aplicado
      INTO v_data, v_param_v1, v_valor_v1
      FROM dw_demo.fato_compra_item c
      JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
     WHERE p.material = 'Ouro'
     ORDER BY c.compra_item_key
     LIMIT 1;
    SELECT md5(string_agg(concat_ws(',', compra_item_key, parametro_preco_ouro_id, preco_ouro_1000_aplicado,
                                    preco_sugerido_unitario, custo_total_pago), ';' ORDER BY compra_item_key))
      INTO v_compras_md5 FROM dw_demo.fato_compra_item;

    -- PRC-05: UPDATE direto do valor é bloqueado.
    BEGIN
        UPDATE dw_demo.parametro_preco_ouro SET preco_ouro_1000 = preco_ouro_1000 + 1 WHERE parametro_id = v_param_v1;
        RAISE EXCEPTION 'FALHA [PRC-05a]: UPDATE do valor foi permitido';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    -- PRC-05: DELETE é bloqueado.
    BEGIN
        DELETE FROM dw_demo.parametro_preco_ouro WHERE parametro_id = v_param_v1;
        RAISE EXCEPTION 'FALHA [PRC-05b]: DELETE foi permitido';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    -- PRC-05: desativação direta (fora da procedure) é bloqueada.
    BEGIN
        UPDATE dw_demo.parametro_preco_ouro SET vigente = false WHERE parametro_id = v_param_v1;
        RAISE EXCEPTION 'FALHA [PRC-05c]: desativação direta foi permitida';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    -- PRC-05: correção sem motivo é recusada.
    BEGIN
        CALL dw_demo.corrigir_preco_ouro(v_data, v_valor_v1 + 10, '  ');
        RAISE EXCEPTION 'FALHA [PRC-05d]: correção sem motivo foi aceita';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    -- PRC-04: correção cria versão 2 vigente e preserva compras já registradas.
    CALL dw_demo.corrigir_preco_ouro(v_data, v_valor_v1 + 10, 'Teste automatizado (desfeito por ROLLBACK)');

    SELECT * INTO v_param_v2 FROM dw_demo.parametro_preco_ouro WHERE data_referencia = v_data AND vigente;
    IF v_param_v2.versao <> 2 OR v_param_v2.substitui_parametro_id <> v_param_v1
       OR v_param_v2.preco_ouro_1000 <> v_valor_v1 + 10 THEN
        RAISE EXCEPTION 'FALHA [PRC-04a]: versão corrigida inconsistente';
    END IF;
    IF (SELECT vigente FROM dw_demo.parametro_preco_ouro WHERE parametro_id = v_param_v1) THEN
        RAISE EXCEPTION 'FALHA [PRC-04b]: versão anterior continua vigente';
    END IF;
    IF (SELECT md5(string_agg(concat_ws(',', compra_item_key, parametro_preco_ouro_id, preco_ouro_1000_aplicado,
                                        preco_sugerido_unitario, custo_total_pago), ';' ORDER BY compra_item_key))
          FROM dw_demo.fato_compra_item) <> v_compras_md5 THEN
        RAISE EXCEPTION 'FALHA [PRC-04c]: a correção alterou compras já registradas';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM audit_demo.correcao_preco_ouro
                    WHERE data_referencia = v_data AND parametro_id_novo = v_param_v2.parametro_id) THEN
        RAISE EXCEPTION 'FALHA [PRC-04d]: correção não registrada em audit_demo';
    END IF;

    -- Versão substituída não pode voltar a ser vigente.
    BEGIN
        UPDATE dw_demo.parametro_preco_ouro SET vigente = true WHERE parametro_id = v_param_v1;
        RAISE EXCEPTION 'FALHA [PRC-05e]: reativação de versão substituída foi permitida';
    EXCEPTION WHEN raise_exception OR unique_violation THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    -- Uma compra de Ouro sem parâmetro é recusada pelo gatilho.
    BEGIN
        INSERT INTO dw_demo.fato_compra_item
            (id_entrada_sintetica, numero_item, id_evento_origem, data_key, data_hora_entrada, produto_key,
             parametro_preco_ouro_id, quantidade_recebida, custo_total_pago, indice_aplicado,
             preco_ouro_1000_aplicado, preco_sugerido_unitario, preco_venda_marcado_unitario, id_execucao)
        SELECT 'DEMO-ENT-TESTE', 1, 'DEMO-ENT-TESTE-001', dw_demo.data_key(v_data), v_data::timestamp,
               p.produto_key, NULL, 1, 100.00, 1.0, NULL, NULL, 200.00,
               (SELECT max(id_execucao) FROM audit_demo.execucao)
          FROM dw_demo.dim_produto p WHERE p.material = 'Ouro' ORDER BY p.produto_key LIMIT 1;
        RAISE EXCEPTION 'FALHA [PRC-02b]: compra de Ouro sem parâmetro foi aceita';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'OK 03_preco_ouro';
END;
$$;

ROLLBACK;
