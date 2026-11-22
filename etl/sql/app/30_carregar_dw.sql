-- =============================================================================
-- 30_carregar_dw.sql — carga do DW real a partir da staging validada.
--
-- As inserções nos fatos são ordenadas pelo id de origem, para que as chaves
-- geradas (identity reiniciada) sejam as mesmas a cada carga.
-- RECARGA COMPLETA (autorizada pelo usuário em 2026-11-22 para staging, dw e
-- bi): o DW é esvaziado e recarregado a cada execução, porque tudo nele é
-- derivado do banco operacional. Rodar duas vezes sobre o mesmo banco
-- operacional produz o mesmo conteúdo (as chaves de produto, preço do ouro e
-- tipo vêm de identificadores estáveis; as demais são reiniciadas).
-- audit não é tocado, exceto pelas inserções de etapas.
-- =============================================================================

-- Chave fixa dos tipos de movimentação (mesma numeração da fase 1 para os
-- códigos que existem nas duas; tipos novos recebem chave a partir de 100).
CREATE OR REPLACE FUNCTION dw.chave_tipo_movimentacao(p_codigo text)
RETURNS smallint
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_codigo
        WHEN 'IMPLANTACAO'     THEN 1
        WHEN 'ENTRADA_COMPRA'  THEN 2
        WHEN 'SAIDA_VENDA'     THEN 3
        WHEN 'SAIDA_PRESENTE'  THEN 4
        WHEN 'SAIDA_ROUBO'     THEN 5
        WHEN 'AJUSTE_POSITIVO' THEN 6
        WHEN 'AJUSTE_NEGATIVO' THEN 7
        WHEN 'SAIDA_PERDA'     THEN 8
        WHEN 'ESTORNO_VENDA'   THEN 9
        WHEN 'ESTORNO_COMPRA'  THEN 10
    END::smallint
$$;

CREATE OR REPLACE PROCEDURE dw.carregar(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio          timestamptz;
    v_ref             date;
    v_extraido        timestamptz;
    v_inicio_estoque  date;
    v_fator           numeric(10,4);
    v_cal_ini         date;
    v_cal_fim         date;
    v_lidas           bigint;
    v_carg            bigint;
    v_rej             bigint;
    v_extra           bigint;
BEGIN
    SELECT max(data_referencia), max(extraido_em) INTO v_ref, v_extraido FROM staging.extracao;
    IF v_ref IS NULL THEN
        RAISE EXCEPTION 'staging.extracao vazia: nada a carregar.';
    END IF;

    -- Início dos snapshots: data da importação das planilhas (primeiro lote).
    -- Sem lote, a primeira movimentação; sem nada, a própria referência.
    SELECT least(coalesce((SELECT min((iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date) FROM staging.importacao_lote),
                          (SELECT min(data_ocorrencia) FROM staging.movimentacao_estoque),
                          v_ref),
                 v_ref)
      INTO v_inicio_estoque;

    SELECT CASE WHEN replace(btrim(valor), ',', '.') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN replace(btrim(valor), ',', '.')::numeric END
      INTO v_fator
      FROM staging.configuracao WHERE chave = 'fator_preco_ouro';

    -- Recarga completa -----------------------------------------------------------
    TRUNCATE TABLE
        dw.fato_snapshot_estoque,
        dw.fato_movimentacao_estoque,
        dw.fato_venda_item,
        dw.fato_compra_item,
        dw.parametro_preco_ouro,
        dw.dim_produto,
        dw.dim_tipo_movimentacao,
        dw.dim_data,
        dw.controle_carga
    RESTART IDENTITY;

    -- dim_data ------------------------------------------------------------------
    v_inicio := clock_timestamp();
    SELECT min(d), max(d) INTO v_cal_ini, v_cal_fim
      FROM (
            SELECT v_ref AS d
            UNION ALL SELECT v_inicio_estoque
            UNION ALL SELECT data_venda FROM staging.venda WHERE NOT staging.rejeitado(p_exec, 'venda', id)
            UNION ALL SELECT data_venda FROM staging.venda_historica WHERE NOT staging.rejeitado(p_exec, 'venda_historica', id)
            UNION ALL SELECT data_aquisicao FROM staging.produto WHERE NOT staging.rejeitado(p_exec, 'produto', id)
            UNION ALL SELECT data_ocorrencia FROM staging.movimentacao_estoque WHERE NOT staging.rejeitado(p_exec, 'movimentacao_estoque', id)
            UNION ALL SELECT vigente_desde FROM staging.preco_ouro WHERE NOT staging.rejeitado(p_exec, 'preco_ouro', id)
           ) t
     WHERE d IS NOT NULL;
    v_cal_ini := make_date(EXTRACT(YEAR FROM v_cal_ini)::integer, 1, 1);

    INSERT INTO dw.dim_data
        (data_key, data, dia, mes, nome_mes, trimestre, ano, ano_mes, dia_semana, nome_dia_semana,
         fim_de_semana, data_comercial, janela_comercial)
    SELECT dw.data_key(d), d,
           EXTRACT(DAY FROM d)::smallint,
           EXTRACT(MONTH FROM d)::smallint,
           (ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                  'setembro','outubro','novembro','dezembro'])[EXTRACT(MONTH FROM d)::integer],
           EXTRACT(QUARTER FROM d)::smallint,
           EXTRACT(YEAR FROM d)::smallint,
           to_char(d, 'YYYY-MM'),
           EXTRACT(ISODOW FROM d)::smallint,
           (ARRAY['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira',
                  'sábado','domingo'])[EXTRACT(ISODOW FROM d)::integer],
           EXTRACT(ISODOW FROM d) IN (6, 7),
           (SELECT dc.data_comercial FROM dw.data_comercial dc
             WHERE dw.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM d)::integer) = d
             ORDER BY dc.data_comercial COLLATE "C" LIMIT 1),
           (SELECT dc.data_comercial FROM dw.data_comercial dc
             WHERE d BETWEEN dw.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM d)::integer) - dc.dias_janela
                         AND dw.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM d)::integer)
             ORDER BY dc.data_comercial COLLATE "C" LIMIT 1)
      FROM generate_series(v_cal_ini, v_cal_fim, interval '1 day') g(dia)
     CROSS JOIN LATERAL (SELECT g.dia::date AS d) x;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'dim_data', v_inicio, v_carg, v_carg, 0,
        format('calendário de %s a %s', v_cal_ini, v_cal_fim));

    -- dim_tipo_movimentacao -------------------------------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.dim_tipo_movimentacao
        (tipo_mov_key, codigo_tipo, descricao_tipo, natureza, sinal, eh_venda, gera_faturamento)
    SELECT coalesce(dw.chave_tipo_movimentacao(t.codigo),
                    (99 + row_number() OVER (PARTITION BY dw.chave_tipo_movimentacao(t.codigo) IS NULL ORDER BY t.codigo))::smallint),
           t.codigo, t.descricao,
           CASE WHEN t.codigo = 'IMPLANTACAO' THEN 'implantação'
                WHEN t.codigo LIKE 'ESTORNO%' THEN 'estorno'
                WHEN t.codigo LIKE 'AJUSTE%' THEN 'ajuste'
                WHEN t.sinal = 1 THEN 'entrada'
                ELSE 'saída' END,
           t.sinal, t.eh_venda, t.eh_venda
      FROM staging.tipo_movimentacao t
     WHERE NOT EXISTS (SELECT 1 FROM audit.rejeicao r WHERE r.id_execucao = p_exec
                         AND r.tabela_origem = 'tipo_movimentacao' AND r.chave_registro = 'codigo=' || t.codigo);
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.tipo_movimentacao;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'tipo_movimentacao';
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'dim_tipo_movimentacao', v_inicio, v_lidas, v_carg, v_rej);

    -- dim_produto -------------------------------------------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.dim_produto
        (produto_key, codigo_produto, descricao, material, tipo_peca, subcategoria, tamanho, peso_g,
         indice_precificacao, modo_controle, local_estoque, ativo, preco_venda, preco_sugerido_atual,
         valor_aquisicao, data_aquisicao, id_execucao, origem_dado)
    SELECT p.id, btrim(p.codigo), btrim(p.descricao), btrim(p.material), btrim(p.categoria), nullif(btrim(p.subcategoria), ''),
           nullif(btrim(p.tamanho), ''), p.peso_gramas, p.indice_preco, p.modo_controle, p.local_estoque, p.ativo,
           p.preco_venda, p.preco_sugerido_atual, p.valor_aquisicao, p.data_aquisicao, p_exec,
           CASE WHEN p.importado_planilha THEN 'PLANILHA' ELSE 'APLICACAO' END
      FROM staging.produto p
     WHERE NOT staging.rejeitado(p_exec, 'produto', p.id);
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.produto;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'produto';
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'dim_produto', v_inicio, v_lidas, v_carg, v_rej);

    -- parametro_preco_ouro ------------------------------------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.parametro_preco_ouro
        (parametro_id, data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente,
         substitui_parametro_id, motivo_correcao, criado_em, id_execucao)
    SELECT id, vigente_desde, versao, valor_grama, 'R$/g ouro 1000 (a confirmar)', versao = total,
           anterior, NULL, registrado_em, p_exec
      FROM (
            SELECT o.*,
                   row_number() OVER w AS versao,
                   count(*) OVER (PARTITION BY o.vigente_desde) AS total,
                   lag(o.id) OVER w AS anterior
              FROM staging.preco_ouro o
             WHERE NOT staging.rejeitado(p_exec, 'preco_ouro', o.id)
            WINDOW w AS (PARTITION BY o.vigente_desde ORDER BY o.registrado_em, o.id)
           ) v
     ORDER BY vigente_desde, versao;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.preco_ouro;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'preco_ouro';
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'parametro_preco_ouro', v_inicio, v_lidas, v_carg, v_rej);

    -- fato_venda_item: APLICACAO (vendas confirmadas) ---------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.fato_venda_item
        (id_venda, numero_item, id_evento_origem, data_key, data_hora_venda, produto_key, quantidade_vendida,
         preco_venda_marcado_unitario, preco_vendido_realizado_unitario, valor_simbolico, id_execucao, origem_dado)
    SELECT v.numero,
           row_number() OVER (PARTITION BY i.venda_id ORDER BY i.id),
           'venda_item:' || i.id,
           dw.data_key(v.data_venda), v.data_venda::timestamp, i.produto_id, i.quantidade,
           i.preco_tabela, i.preco_praticado, false, p_exec, 'APLICACAO'
      FROM staging.venda_item i
      JOIN staging.venda v ON v.id = i.venda_id
     WHERE v.situacao = 'CONFIRMADA'
       AND NOT staging.rejeitado(p_exec, 'venda_item', i.id)
     ORDER BY i.id;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.venda_item;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'venda_item';
    SELECT count(*) INTO v_extra
      FROM staging.venda_item i JOIN staging.venda v ON v.id = i.venda_id
     WHERE v.situacao = 'CANCELADA' AND NOT staging.rejeitado(p_exec, 'venda_item', i.id);
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'fato_venda_item (APLICACAO)', v_inicio, v_lidas, v_carg, v_rej,
        format('%s item(ns) de vendas canceladas ficam fora do fato (as movimentações de venda e estorno entram)', v_extra));

    -- fato_venda_item: PLANILHA (histórico importado) ---------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.fato_venda_item
        (id_venda, numero_item, id_evento_origem, data_key, data_hora_venda, produto_key, quantidade_vendida,
         preco_venda_marcado_unitario, preco_vendido_realizado_unitario, valor_simbolico, id_execucao, origem_dado)
    SELECT NULL, 1, 'venda_historica:' || h.id, dw.data_key(h.data_venda), h.data_venda::timestamp, h.produto_id, 1,
           NULL, h.valor_venda, h.simbolico, p_exec, 'PLANILHA'
      FROM staging.venda_historica h
     WHERE NOT staging.rejeitado(p_exec, 'venda_historica', h.id)
     ORDER BY h.id;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.venda_historica;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'venda_historica';
    SELECT count(*) INTO v_extra FROM dw.fato_venda_item WHERE origem_dado = 'PLANILHA' AND NOT entra_faturamento;
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'fato_venda_item (PLANILHA)', v_inicio, v_lidas, v_carg, v_rej,
        format('%s venda(s) histórica(s) fora do faturamento (valor simbólico ou sem valor)', v_extra));

    -- fato_compra_item (produtos com data de aquisição) ---------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.fato_compra_item
        (id_evento_origem, data_key, data_hora_entrada, produto_key, parametro_preco_ouro_id, quantidade_recebida,
         custo_total_pago, indice_aplicado, preco_ouro_1000_aplicado, preco_sugerido_unitario,
         preco_venda_marcado_unitario, id_execucao, origem_dado)
    SELECT 'produto:' || p.id, dw.data_key(p.data_aquisicao), p.data_aquisicao::timestamp, p.id,
           o.parametro_id, 1, p.valor_aquisicao, p.indice_preco, o.preco_ouro_1000, p.preco_sugerido_aquisicao,
           p.preco_venda, p_exec,
           CASE WHEN p.importado_planilha THEN 'PLANILHA' ELSE 'APLICACAO' END
      FROM staging.produto p
      LEFT JOIN LATERAL (
            SELECT x.parametro_id, x.preco_ouro_1000
              FROM dw.parametro_preco_ouro x
             WHERE x.vigente AND x.data_referencia <= p.data_aquisicao
             ORDER BY x.data_referencia DESC
             LIMIT 1
           ) o ON true
     WHERE p.data_aquisicao IS NOT NULL
       AND NOT staging.rejeitado(p_exec, 'produto', p.id)
     ORDER BY p.id;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.produto WHERE data_aquisicao IS NOT NULL;
    SELECT count(*) INTO v_rej FROM staging.produto p
     WHERE p.data_aquisicao IS NOT NULL AND staging.rejeitado(p_exec, 'produto', p.id);
    SELECT count(*) INTO v_extra FROM staging.produto WHERE data_aquisicao IS NULL;
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'fato_compra_item', v_inicio, v_lidas, v_carg, v_rej,
        format('%s produto(s) sem data de aquisição não entram', v_extra));

    -- fato_movimentacao_estoque ----------------------------------------------------------
    v_inicio := clock_timestamp();
    INSERT INTO dw.fato_movimentacao_estoque
        (id_evento_origem, data_key, data_hora_evento, produto_key, tipo_mov_key, quantidade, saldo_apos,
         custo_unitario, id_venda, registrado_em, id_execucao, origem_dado)
    SELECT 'movimentacao:' || m.id, dw.data_key(m.data_ocorrencia), m.data_ocorrencia::timestamp, m.produto_id,
           t.tipo_mov_key, m.quantidade, m.saldo_apos, m.custo_unitario, v.numero, m.registrada_em, p_exec,
           CASE WHEN m.tipo_codigo = 'IMPLANTACAO' AND p.importado_planilha THEN 'PLANILHA' ELSE 'APLICACAO' END
      FROM staging.movimentacao_estoque m
      JOIN dw.dim_tipo_movimentacao t ON t.codigo_tipo = m.tipo_codigo
      JOIN staging.produto p ON p.id = m.produto_id
      LEFT JOIN staging.venda_item i ON i.id = m.venda_item_id
      LEFT JOIN staging.venda v ON v.id = i.venda_id
     WHERE NOT staging.rejeitado(p_exec, 'movimentacao_estoque', m.id)
     ORDER BY m.id;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(*) INTO v_lidas FROM staging.movimentacao_estoque;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit.rejeicao WHERE id_execucao = p_exec AND tabela_origem = 'movimentacao_estoque';
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'fato_movimentacao_estoque', v_inicio, v_lidas, v_carg, v_rej);

    -- fato_snapshot_estoque: diário, da data da importação até a referência ------------
    -- Cada produto entra a partir do primeiro dia em que existe (cadastro ou
    -- primeira movimentação), nunca antes da data da importação.
    v_inicio := clock_timestamp();
    INSERT INTO dw.fato_snapshot_estoque (data_key, produto_key, quantidade_em_estoque, id_execucao)
    WITH delta AS (
        SELECT f.produto_key, f.data_hora_evento::date AS dia, sum(f.quantidade * t.sinal) AS d
          FROM dw.fato_movimentacao_estoque f
          JOIN dw.dim_tipo_movimentacao t ON t.tipo_mov_key = f.tipo_mov_key
         GROUP BY f.produto_key, f.data_hora_evento::date
    ),
    inicio AS (
        SELECT p.produto_key,
               least(v_ref, greatest(v_inicio_estoque,
                     least((s.criado_em AT TIME ZONE 'America/Sao_Paulo')::date,
                           coalesce((SELECT min(x.dia) FROM delta x WHERE x.produto_key = p.produto_key), v_ref)))) AS dia
          FROM dw.dim_produto p
          JOIN staging.produto s ON s.id = p.produto_key
    ),
    base AS (
        SELECT i.produto_key, coalesce(sum(x.d), 0) AS saldo
          FROM inicio i
          LEFT JOIN delta x ON x.produto_key = i.produto_key AND x.dia < i.dia
         GROUP BY i.produto_key
    ),
    dias AS (
        SELECT i.produto_key, g.dia::date AS dia
          FROM inicio i
         CROSS JOIN LATERAL generate_series(i.dia, v_ref, interval '1 day') g(dia)
    )
    SELECT dw.data_key(d.dia), d.produto_key,
           b.saldo + sum(coalesce(x.d, 0)) OVER (PARTITION BY d.produto_key ORDER BY d.dia),
           p_exec
      FROM dias d
      JOIN base b ON b.produto_key = d.produto_key
      LEFT JOIN delta x ON x.produto_key = d.produto_key AND x.dia = d.dia
     ORDER BY d.produto_key, d.dia;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    CALL audit.registrar_etapa(p_exec, 'carregar_dw', 'fato_snapshot_estoque', v_inicio, NULL, v_carg, 0,
        format('posições diárias de %s a %s', v_inicio_estoque, v_ref));

    INSERT INTO dw.controle_carga (id, id_execucao, extraido_em, data_referencia, data_inicio_estoque, fator_preco_ouro)
    VALUES (1, p_exec, v_extraido, v_ref, v_inicio_estoque, v_fator);
END;
$$;
