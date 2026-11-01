-- =============================================================================
-- 31_carregar_fatos.sql — fato_compra_item, fato_venda_item e
-- fato_movimentacao_estoque. Inserção por id_evento_origem com
-- ON CONFLICT DO NOTHING: reexecuções não duplicam e NÃO sobrescrevem custos.
-- =============================================================================

CREATE OR REPLACE PROCEDURE dw_demo.carregar_fatos(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio  timestamptz;
    v_lidas   bigint;
    v_carg    bigint;
    v_rej     bigint;   -- rejeições (subconsultas não são aceitas em argumentos de CALL)
BEGIN
    -- ------------------------------------------------------- fato_compra_item
    -- Preço do ouro: versão VIGENTE da MESMA data (Ouro/Prata). Folheado: NULL.
    v_inicio := clock_timestamp();
    SELECT count(*) INTO v_lidas FROM staging_demo.entrada_gerada WHERE id_execucao = p_exec;
    INSERT INTO dw_demo.fato_compra_item
        (id_entrada_sintetica, numero_item, id_evento_origem, data_key, data_hora_entrada, produto_key,
         parametro_preco_ouro_id, quantidade_recebida, custo_total_pago, indice_aplicado,
         preco_ouro_1000_aplicado, preco_sugerido_unitario, preco_venda_marcado_unitario, id_execucao, origem_dado)
    SELECT e.id_entrada_sintetica,
           e.numero_item,
           e.id_evento_origem,
           dw_demo.data_key(e.data_hora_entrada::date),
           e.data_hora_entrada,
           p.produto_key,
           pp.parametro_id,
           e.quantidade_recebida,
           e.custo_total_pago,
           e.indice_aplicado,
           pp.preco_ouro_1000,
           CASE WHEN p.material IN ('Ouro', 'Prata')
                THEN dw_demo.calcular_preco_sugerido(pp.preco_ouro_1000, e.indice_aplicado)
           END,
           e.preco_venda_marcado_unitario,
           p_exec,
           e.origem_dado
      FROM staging_demo.entrada_gerada e
      JOIN dw_demo.dim_produto p ON p.codigo_produto = e.codigo_produto
      LEFT JOIN dw_demo.parametro_preco_ouro pp
             ON p.material IN ('Ouro', 'Prata')
            AND pp.data_referencia = e.data_hora_entrada::date
            AND pp.vigente
     WHERE e.id_execucao = p_exec
       AND NOT staging_demo.rejeitado(p_exec, 'entrada_gerada', e.id_evento_origem)
     ORDER BY e.id_evento_origem COLLATE "C"
    ON CONFLICT (id_evento_origem) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit_demo.rejeicao
     WHERE id_execucao = p_exec AND tabela_origem = 'entrada_gerada';
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_fato_compra_item', v_inicio, v_lidas, v_carg, v_rej,
        'Linhas novas; itens já carregados (mesmo id_evento_origem) não são alterados.');

    -- -------------------------------------------------------- fato_venda_item
    v_inicio := clock_timestamp();
    SELECT count(*) INTO v_lidas FROM staging_demo.venda_gerada WHERE id_execucao = p_exec;
    INSERT INTO dw_demo.fato_venda_item
        (id_venda_sintetica, numero_item, id_evento_origem, data_key, data_hora_venda, produto_key,
         quantidade_vendida, preco_venda_marcado_unitario, preco_vendido_realizado_unitario, id_execucao, origem_dado)
    SELECT v.id_venda_sintetica,
           v.numero_item,
           v.id_evento_origem,
           dw_demo.data_key(v.data_hora_venda::date),
           v.data_hora_venda,
           p.produto_key,
           v.quantidade_vendida,
           v.preco_venda_marcado_unitario,
           v.preco_vendido_realizado_unitario,
           p_exec,
           v.origem_dado
      FROM staging_demo.venda_gerada v
      JOIN dw_demo.dim_produto p ON p.codigo_produto = v.codigo_produto
     WHERE v.id_execucao = p_exec
       AND NOT staging_demo.rejeitado(p_exec, 'venda_gerada', v.id_evento_origem)
     ORDER BY v.id_evento_origem COLLATE "C"
    ON CONFLICT (id_evento_origem) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit_demo.rejeicao
     WHERE id_execucao = p_exec AND tabela_origem = 'venda_gerada';
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_fato_venda_item', v_inicio, v_lidas, v_carg, v_rej,
        'Linhas novas.');

    -- ---------------------------------------------- fato_movimentacao_estoque
    v_inicio := clock_timestamp();
    SELECT count(*) INTO v_lidas FROM staging_demo.movimento_gerado WHERE id_execucao = p_exec;
    INSERT INTO dw_demo.fato_movimentacao_estoque
        (id_evento_origem, data_key, data_hora_evento, produto_key, tipo_mov_key, quantidade, id_execucao, origem_dado)
    SELECT m.id_evento_origem,
           dw_demo.data_key(m.data_hora_evento::date),
           m.data_hora_evento,
           p.produto_key,
           t.tipo_mov_key,
           m.quantidade,
           p_exec,
           m.origem_dado
      FROM staging_demo.movimento_gerado m
      JOIN dw_demo.dim_produto p ON p.codigo_produto = m.codigo_produto
      JOIN dw_demo.dim_tipo_movimentacao t ON t.codigo_tipo = m.codigo_tipo
     WHERE m.id_execucao = p_exec
       AND NOT staging_demo.rejeitado(p_exec, 'movimento_gerado', m.id_evento_origem)
     ORDER BY m.data_hora_evento, m.id_evento_origem COLLATE "C"
    ON CONFLICT (id_evento_origem) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit_demo.rejeicao
     WHERE id_execucao = p_exec AND tabela_origem = 'movimento_gerado';
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_fato_movimentacao_estoque', v_inicio, v_lidas, v_carg, v_rej,
        'Linhas novas.');
END;
$$;
