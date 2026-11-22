-- =============================================================================
-- 10_auditoria.sql — controle das execuções do ETL real (audit).
-- Chamadas por scripts/run_etl_app.ps1, cada etapa em transação própria.
-- audit só recebe inserções; a execução é fechada uma única vez.
-- =============================================================================

-- Abre uma execução e devolve o identificador.
CREATE OR REPLACE FUNCTION audit.iniciar_execucao(p_banco_origem text, p_usuario_origem text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO audit.execucao (status, banco_origem, usuario_origem)
    VALUES ('EM_EXECUCAO', p_banco_origem, p_usuario_origem)
    RETURNING id_execucao INTO v_id;
    RETURN v_id;
END;
$$;

-- Registra as contagens de uma etapa (por tabela).
CREATE OR REPLACE PROCEDURE audit.registrar_etapa(
    p_exec bigint, p_etapa text, p_tabela text, p_inicio timestamptz,
    p_lidas bigint, p_carregadas bigint, p_rejeitadas bigint, p_obs text DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit.etapa (id_execucao, etapa, tabela, iniciado_em, linhas_lidas, linhas_carregadas, linhas_rejeitadas, observacao)
    VALUES (p_exec, p_etapa, p_tabela, p_inicio, p_lidas, p_carregadas, p_rejeitadas, p_obs);
END;
$$;

-- Registra o resultado de uma verificação de qualidade.
CREATE OR REPLACE PROCEDURE audit.registrar_verificacao(
    p_exec bigint, p_codigo text, p_grupo text, p_descricao text,
    p_esperado text, p_obtido text, p_aprovado boolean)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit.resultado_validacao (id_execucao, codigo, grupo, descricao, esperado, obtido, aprovado)
    VALUES (p_exec, p_codigo, p_grupo, p_descricao, p_esperado, p_obtido, coalesce(p_aprovado, false));
END;
$$;

-- Fecha a execução (uma única vez: o gatilho de audit recusa reabrir).
CREATE OR REPLACE PROCEDURE audit.finalizar_execucao(p_exec bigint, p_status text, p_mensagem text DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE audit.execucao
       SET status = p_status, finalizado_em = clock_timestamp(), mensagem = p_mensagem
     WHERE id_execucao = p_exec AND status = 'EM_EXECUCAO';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Execução % inexistente ou já finalizada.', p_exec;
    END IF;
END;
$$;
