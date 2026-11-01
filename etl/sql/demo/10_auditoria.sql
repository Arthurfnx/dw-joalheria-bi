-- =============================================================================
-- 10_auditoria.sql — controle de execuções do ETL demonstrativo.
-- Cada etapa é chamada em uma transação própria por scripts/run_demo_etl.ps1.
-- =============================================================================

-- Abre uma execução e devolve seu identificador.
CREATE OR REPLACE FUNCTION audit_demo.iniciar_execucao()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO audit_demo.execucao (status) VALUES ('EM_EXECUCAO') RETURNING id_execucao INTO v_id;
    RETURN v_id;
END;
$$;

-- Registra contagens de uma etapa.
CREATE OR REPLACE PROCEDURE audit_demo.registrar_etapa(
    p_exec bigint, p_etapa text, p_inicio timestamptz,
    p_lidas bigint, p_carregadas bigint, p_rejeitadas bigint, p_obs text DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_demo.etapa (id_execucao, etapa, iniciado_em, linhas_lidas, linhas_carregadas, linhas_rejeitadas, observacao)
    VALUES (p_exec, p_etapa, p_inicio, p_lidas, p_carregadas, p_rejeitadas, p_obs);
END;
$$;

-- Valida a configuração e garante que os dados do DW vieram da MESMA configuração.
-- Configuração diferente => exceção (exige reset controlado).
CREATE OR REPLACE PROCEDURE audit_demo.verificar_configuracao(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio   timestamptz := clock_timestamp();
    v_hash     char(32);
    v_semente  bigint;
    v_ctrl     dw_demo.controle_carga%ROWTYPE;
BEGIN
    PERFORM config_demo.validar_configuracao();
    v_hash    := config_demo.hash_configuracao();
    v_semente := config_demo.param_inteiro('semente');

    UPDATE audit_demo.execucao SET hash_configuracao = v_hash, semente = v_semente WHERE id_execucao = p_exec;

    SELECT * INTO v_ctrl FROM dw_demo.controle_carga WHERE id = 1;
    IF FOUND THEN
        IF v_ctrl.hash_configuracao <> v_hash THEN
            RAISE EXCEPTION 'A configuração atual (hash %) difere da que gerou os dados do DW demo (hash %). Execute o reset controlado (scripts/reset_demo.ps1) antes de recarregar.',
                v_hash, v_ctrl.hash_configuracao;
        END IF;
        UPDATE dw_demo.controle_carga SET ultima_execucao = p_exec, atualizado_em = clock_timestamp() WHERE id = 1;
    ELSE
        IF EXISTS (SELECT 1 FROM dw_demo.dim_produto) OR EXISTS (SELECT 1 FROM dw_demo.fato_movimentacao_estoque) THEN
            RAISE EXCEPTION 'dw_demo contém dados sem registro de controle_carga. Execute o reset controlado.';
        END IF;
        INSERT INTO dw_demo.controle_carga (id, hash_configuracao, semente, primeira_execucao, ultima_execucao)
        VALUES (1, v_hash, v_semente, p_exec, p_exec);
    END IF;

    CALL audit_demo.registrar_etapa(p_exec, 'verificar_configuracao', v_inicio, NULL, NULL, NULL, 'hash ' || v_hash);
END;
$$;

-- Fecha a execução.
CREATE OR REPLACE PROCEDURE audit_demo.finalizar_execucao(p_exec bigint, p_status text, p_mensagem text DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE audit_demo.execucao
       SET status = p_status, finalizado_em = clock_timestamp(), mensagem = p_mensagem
     WHERE id_execucao = p_exec;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Execução % inexistente.', p_exec;
    END IF;
END;
$$;

-- Registra o resultado de uma verificação de qualidade.
CREATE OR REPLACE PROCEDURE audit_demo.registrar_verificacao(
    p_exec bigint, p_codigo text, p_grupo text, p_descricao text,
    p_esperado text, p_obtido text, p_aprovado boolean)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_demo.resultado_validacao (id_execucao, codigo, grupo, descricao, esperado, obtido, aprovado)
    VALUES (p_exec, p_codigo, p_grupo, p_descricao, p_esperado, p_obtido, coalesce(p_aprovado, false))
    ON CONFLICT (id_execucao, codigo) DO UPDATE
        SET esperado = EXCLUDED.esperado, obtido = EXCLUDED.obtido,
            aprovado = EXCLUDED.aprovado, verificado_em = clock_timestamp();
END;
$$;

-- -----------------------------------------------------------------------------
-- RESET CONTROLADO (operação destrutiva sobre dados SINTÉTICOS).
-- Limpa staging_demo e dw_demo (exceto o domínio fixo dim_tipo_movimentacao).
-- Preserva config_demo e o histórico de audit_demo.
-- Exige a frase de confirmação exata. Só deve ser executado com autorização
-- explícita do usuário (scripts/reset_demo.ps1 pede confirmação interativa).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE audit_demo.resetar_ambiente_demo(p_confirmacao text)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_confirmacao IS DISTINCT FROM 'LIMPAR AMBIENTE DEMO' THEN
        RAISE EXCEPTION 'Reset não executado: frase de confirmação inválida.';
    END IF;

    TRUNCATE TABLE
        dw_demo.fato_snapshot_estoque,
        dw_demo.fato_movimentacao_estoque,
        dw_demo.fato_venda_item,
        dw_demo.fato_compra_item,
        dw_demo.parametro_preco_ouro,
        dw_demo.dim_produto,
        dw_demo.dim_data,
        dw_demo.controle_carga,
        staging_demo.saldo_final_gerador,
        staging_demo.movimento_gerado,
        staging_demo.venda_gerada,
        staging_demo.entrada_gerada,
        staging_demo.preco_ouro_gerado,
        staging_demo.produto_perfil_simulacao,
        staging_demo.produto_gerado
    RESTART IDENTITY;

    INSERT INTO audit_demo.reset_registro (observacao)
    VALUES ('Reset controlado: staging_demo e dw_demo limpos; config_demo e audit_demo preservados.');
END;
$$;
COMMENT ON PROCEDURE audit_demo.resetar_ambiente_demo(text) IS 'DESTRUTIVO (dados sintéticos). Requer a frase ''LIMPAR AMBIENTE DEMO''. Usar somente com autorização explícita.';
