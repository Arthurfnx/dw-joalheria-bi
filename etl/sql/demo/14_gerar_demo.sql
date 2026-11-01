-- =============================================================================
-- 14_gerar_demo.sql — etapa de geração: catálogo, série do ouro e simulação.
-- =============================================================================

CREATE OR REPLACE PROCEDURE staging_demo.gerar_demo(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio  timestamptz := clock_timestamp();
    v_linhas  bigint;
    v_prod    bigint;
    v_preco   bigint;
    v_ent     bigint;
    v_vnd     bigint;
    v_mov     bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM staging_demo.produto_gerado WHERE id_execucao = p_exec) THEN
        RAISE EXCEPTION 'A execução % já possui dados gerados em staging_demo.', p_exec;
    END IF;

    CALL staging_demo.gerar_catalogo(p_exec);
    CALL staging_demo.gerar_preco_ouro(p_exec);
    CALL staging_demo.simular_operacao(p_exec);

    -- O PostgreSQL não aceita subconsultas nos argumentos de CALL:
    -- as contagens são calculadas antes e passadas como variáveis.
    SELECT count(*) INTO v_prod  FROM staging_demo.produto_gerado    WHERE id_execucao = p_exec;
    SELECT count(*) INTO v_preco FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec;
    SELECT count(*) INTO v_ent   FROM staging_demo.entrada_gerada    WHERE id_execucao = p_exec;
    SELECT count(*) INTO v_vnd   FROM staging_demo.venda_gerada      WHERE id_execucao = p_exec;
    SELECT count(*) INTO v_mov   FROM staging_demo.movimento_gerado  WHERE id_execucao = p_exec;
    v_linhas := v_prod + v_preco + v_ent + v_vnd + v_mov;

    CALL audit_demo.registrar_etapa(p_exec, 'gerar_demo', v_inicio, NULL, v_linhas, 0,
        format('produtos=%s; precos_ouro=%s; entradas=%s; vendas_itens=%s; movimentos=%s',
               v_prod, v_preco, v_ent, v_vnd, v_mov));
END;
$$;

-- md5 do conteúdo gerado (sem id_execucao), para verificar determinismo (REP-02).
CREATE OR REPLACE FUNCTION staging_demo.md5_conteudo(p_exec bigint)
RETURNS char(32)
LANGUAGE sql STABLE
AS $$
    SELECT md5(concat_ws('#',
        (SELECT string_agg(concat_ws(',', codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao),
                           ';' ORDER BY codigo_produto COLLATE "C")
           FROM staging_demo.produto_gerado WHERE id_execucao = p_exec),
        (SELECT string_agg(concat_ws(',', codigo_produto, perfil_movimentacao_demo, saldo_inicial),
                           ';' ORDER BY codigo_produto COLLATE "C")
           FROM staging_demo.produto_perfil_simulacao WHERE id_execucao = p_exec),
        (SELECT string_agg(concat_ws(',', data_referencia, preco_ouro_1000, unidade_referencia), ';' ORDER BY data_referencia)
           FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec),
        (SELECT string_agg(concat_ws(',', id_evento_origem, data_hora_entrada, codigo_produto, quantidade_recebida,
                                     custo_total_pago, indice_aplicado, preco_venda_marcado_unitario),
                           ';' ORDER BY id_evento_origem COLLATE "C")
           FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec),
        (SELECT string_agg(concat_ws(',', id_evento_origem, data_hora_venda, codigo_produto, quantidade_vendida,
                                     preco_venda_marcado_unitario, preco_vendido_realizado_unitario, cenario_preco),
                           ';' ORDER BY id_evento_origem COLLATE "C")
           FROM staging_demo.venda_gerada WHERE id_execucao = p_exec),
        (SELECT string_agg(concat_ws(',', id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade),
                           ';' ORDER BY id_evento_origem COLLATE "C")
           FROM staging_demo.movimento_gerado WHERE id_execucao = p_exec)
    ))::char(32)
$$;
