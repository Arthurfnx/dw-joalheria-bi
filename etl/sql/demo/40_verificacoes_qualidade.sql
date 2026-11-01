-- =============================================================================
-- 40_verificacoes_qualidade.sql — verificações de docs/data_quality.md.
-- Resultado gravado em audit_demo.resultado_validacao. Retorna o número de
-- verificações reprovadas. PRC-04/PRC-05 (comportamento do versionamento) são
-- cobertas por tests/sql/03_preco_ouro.sql (executadas com ROLLBACK).
-- =============================================================================

CREATE OR REPLACE FUNCTION audit_demo.executar_verificacoes(p_exec bigint)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio     timestamptz := clock_timestamp();
    v_n          bigint;
    v_m          bigint;
    v_x          bigint;
    v_txt        text;
    v_md5_atual  char(32);
    v_md5_ant    char(32);
    v_exec_ant   bigint;
    v_hash       char(32);
    v_tol        numeric := config_demo.param_decimal('tolerancia_proporcao_preco');
    v_p_igual    numeric := config_demo.param_decimal('prob_preco_igual');
    v_p_abaixo   numeric := config_demo.param_decimal('prob_preco_abaixo');
    v_s_igual    numeric;
    v_s_abaixo   numeric;
    v_s_acima    numeric;
    v_falhas     integer;
BEGIN
    -- EST-01 — schemas
    SELECT count(*) INTO v_n FROM pg_namespace
     WHERE nspname IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo', 'audit_demo');
    SELECT count(*) INTO v_m FROM pg_namespace WHERE nspname IN ('staging', 'dw', 'bi', 'audit');
    CALL audit_demo.registrar_verificacao(p_exec, 'EST-01', 'Estrutura',
        'Cinco schemas *_demo existem; nenhuma schema real (staging, dw, bi, audit) criada.',
        'demo=5; reais=0', format('demo=%s; reais=%s', v_n, v_m), v_n = 5 AND v_m = 0);

    -- EST-02 — restrições, gatilhos e índice parcial
    SELECT count(*) INTO v_n
      FROM unnest(ARRAY[
            'pk_dim_produto', 'uq_dim_produto_codigo', 'ck_dim_produto_ouro_peso', 'ck_dim_produto_folheado_sem_peso',
            'ck_dim_produto_anel_tamanho', 'ck_dim_produto_ouro_tamanho', 'ck_dim_produto_indice',
            'pk_dim_data', 'ck_dim_data_key', 'pk_dim_tipo_movimentacao', 'ck_dim_tipo_mov_sinal',
            'pk_parametro_preco_ouro', 'uq_parametro_preco_ouro_versao', 'ck_parametro_preco_ouro_versao',
            'pk_fato_compra_item', 'uq_fato_compra_evento', 'fk_fato_compra_parametro',
            'ck_fato_compra_ouro_coerente', 'ck_fato_compra_sugerido_formula',
            'pk_fato_venda_item', 'uq_fato_venda_evento', 'ck_fato_venda_realizado',
            'pk_fato_movimentacao', 'uq_fato_mov_evento', 'fk_fato_mov_tipo', 'ck_fato_mov_quantidade',
            'pk_fato_snapshot', 'uq_fato_snapshot_produto_data', 'ck_fato_snapshot_quantidade'
           ]) AS c(nome)
     WHERE NOT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_namespace s ON s.oid = k.connamespace
                        WHERE s.nspname = 'dw_demo' AND k.conname = c.nome);
    SELECT count(*) INTO v_m
      FROM unnest(ARRAY['tg_parametro_preco_ouro_protecao', 'tg_fato_compra_item_regras']) AS t(nome)
     WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgname = t.nome AND NOT g.tgisinternal);
    SELECT count(*) INTO v_x FROM pg_indexes
     WHERE schemaname = 'dw_demo' AND indexname = 'uq_parametro_preco_ouro_vigente';
    CALL audit_demo.registrar_verificacao(p_exec, 'EST-02', 'Estrutura',
        'Restrições, gatilhos e índice parcial previstos existem.',
        'restrições ausentes=0; gatilhos ausentes=0; índice vigente=1',
        format('restrições ausentes=%s; gatilhos ausentes=%s; índice vigente=%s', v_n, v_m, v_x),
        v_n = 0 AND v_m = 0 AND v_x = 1);

    -- CAT-01..04 — catálogo
    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE material = 'Ouro' AND (peso_g IS NULL OR peso_g <= 0);
    CALL audit_demo.registrar_verificacao(p_exec, 'CAT-01', 'Catálogo', 'Todo Ouro tem peso_g > 0.',
        '0', v_n::text, v_n = 0);

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE material = 'Folheado' AND peso_g IS NOT NULL;
    CALL audit_demo.registrar_verificacao(p_exec, 'CAT-02', 'Catálogo', 'Todo Folheado tem peso_g NULL.',
        '0', v_n::text, v_n = 0);

    SELECT count(*) FILTER (WHERE tipo_peca = 'Anel' AND tamanho IS NULL),
           count(*) FILTER (WHERE material = 'Ouro' AND tipo_peca <> 'Anel' AND tamanho IS NOT NULL)
      INTO v_n, v_m FROM dw_demo.dim_produto;
    CALL audit_demo.registrar_verificacao(p_exec, 'CAT-03', 'Catálogo',
        'Todo Anel tem tamanho; Ouro só tem tamanho quando Anel; demais tipos sem obrigatoriedade.',
        'anel sem tamanho=0; ouro não-anel com tamanho=0',
        format('anel sem tamanho=%s; ouro não-anel com tamanho=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto
     WHERE indice_precificacao <= 0 OR codigo_produto !~ '^DEMO-(OURO|PRATA|FOLHADO)-[0-9]{4}$';
    CALL audit_demo.registrar_verificacao(p_exec, 'CAT-04', 'Catálogo',
        'Índice > 0 e código no padrão DEMO-<MATERIAL>-NNNN.', '0', v_n::text, v_n = 0);

    -- PRC-01 — série do preço do ouro
    SELECT count(*) INTO v_n
      FROM dw_demo.dim_data d
     WHERE NOT EXISTS (SELECT 1 FROM dw_demo.parametro_preco_ouro pp WHERE pp.data_referencia = d.data AND pp.vigente);
    SELECT count(*) INTO v_m FROM dw_demo.parametro_preco_ouro WHERE unidade_referencia <> 'NAO_CONFIRMADA_DEMO';
    CALL audit_demo.registrar_verificacao(p_exec, 'PRC-01', 'Preço',
        'Um preço vigente por dia do período, com unidade NAO_CONFIRMADA_DEMO.',
        'dias sem preço=0; unidade diferente=0', format('dias sem preço=%s; unidade diferente=%s', v_n, v_m),
        v_n = 0 AND v_m = 0);

    -- PRC-02 — compra de Ouro/Prata com parâmetro da mesma data; Folheado sem parâmetro
    SELECT count(*) FILTER (WHERE p.material IN ('Ouro', 'Prata')
                              AND (c.parametro_preco_ouro_id IS NULL OR pp.data_referencia <> c.data_hora_entrada::date)),
           count(*) FILTER (WHERE p.material = 'Folheado' AND c.parametro_preco_ouro_id IS NOT NULL)
      INTO v_n, v_m
      FROM dw_demo.fato_compra_item c
      JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
      LEFT JOIN dw_demo.parametro_preco_ouro pp ON pp.parametro_id = c.parametro_preco_ouro_id;
    CALL audit_demo.registrar_verificacao(p_exec, 'PRC-02', 'Preço',
        'Compras de Ouro/Prata referenciam o preço da mesma data; Folheado sem parâmetro.',
        'ouro/prata inválidas=0; folheado com parâmetro=0',
        format('ouro/prata inválidas=%s; folheado com parâmetro=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- PRC-03 — fórmula do preço sugerido
    SELECT count(*) FILTER (WHERE p.material IN ('Ouro', 'Prata')
                              AND c.preco_sugerido_unitario IS DISTINCT FROM
                                  dw_demo.calcular_preco_sugerido(c.preco_ouro_1000_aplicado, c.indice_aplicado)),
           count(*) FILTER (WHERE p.material = 'Folheado' AND c.preco_sugerido_unitario IS NOT NULL)
      INTO v_n, v_m
      FROM dw_demo.fato_compra_item c
      JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key;
    CALL audit_demo.registrar_verificacao(p_exec, 'PRC-03', 'Preço',
        'Preço sugerido = preço do ouro × 1,6 × índice (Ouro/Prata); NULL para Folheado.',
        'divergências=0; folheado com sugerido=0',
        format('divergências=%s; folheado com sugerido=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- MOV-01 — quantidade positiva
    SELECT count(*) INTO v_n FROM dw_demo.fato_movimentacao_estoque WHERE quantidade <= 0;
    CALL audit_demo.registrar_verificacao(p_exec, 'MOV-01', 'Movimentação',
        'Quantidade > 0 em todas as movimentações (sinal vem do tipo).', '0', v_n::text, v_n = 0);

    -- MOV-02 — venda ↔ SAIDA_VENDA 1:1
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_venda_item v
     WHERE NOT EXISTS (SELECT 1 FROM dw_demo.fato_movimentacao_estoque m
                        JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
                       WHERE m.id_evento_origem = v.id_evento_origem AND t.codigo_tipo = 'SAIDA_VENDA'
                         AND m.produto_key = v.produto_key AND m.data_hora_evento = v.data_hora_venda
                         AND m.quantidade = v.quantidade_vendida);
    SELECT count(*) INTO v_m
      FROM dw_demo.fato_movimentacao_estoque m
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE t.codigo_tipo = 'SAIDA_VENDA'
       AND NOT EXISTS (SELECT 1 FROM dw_demo.fato_venda_item v WHERE v.id_evento_origem = m.id_evento_origem);
    CALL audit_demo.registrar_verificacao(p_exec, 'MOV-02', 'Movimentação',
        'Cada item de venda tem exatamente uma SAIDA_VENDA equivalente e vice-versa.',
        'itens sem movimento=0; movimentos sem item=0',
        format('itens sem movimento=%s; movimentos sem item=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- MOV-03 — compra ↔ ENTRADA_COMPRA 1:1
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_compra_item c
     WHERE NOT EXISTS (SELECT 1 FROM dw_demo.fato_movimentacao_estoque m
                        JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
                       WHERE m.id_evento_origem = c.id_evento_origem AND t.codigo_tipo = 'ENTRADA_COMPRA'
                         AND m.produto_key = c.produto_key AND m.data_hora_evento = c.data_hora_entrada
                         AND m.quantidade = c.quantidade_recebida);
    SELECT count(*) INTO v_m
      FROM dw_demo.fato_movimentacao_estoque m
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE t.codigo_tipo = 'ENTRADA_COMPRA'
       AND NOT EXISTS (SELECT 1 FROM dw_demo.fato_compra_item c WHERE c.id_evento_origem = m.id_evento_origem);
    CALL audit_demo.registrar_verificacao(p_exec, 'MOV-03', 'Movimentação',
        'Cada item de compra tem exatamente uma ENTRADA_COMPRA equivalente e vice-versa.',
        'itens sem movimento=0; movimentos sem item=0',
        format('itens sem movimento=%s; movimentos sem item=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- MOV-04 — saídas não comerciais fora da fato de vendas; quantidades reconciliadas
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_venda_item v
      JOIN dw_demo.fato_movimentacao_estoque m ON m.id_evento_origem = v.id_evento_origem
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE NOT t.eh_venda;
    SELECT coalesce(sum(quantidade_vendida), 0) INTO v_m FROM dw_demo.fato_venda_item;
    SELECT coalesce(sum(m.quantidade), 0) INTO v_x
      FROM dw_demo.fato_movimentacao_estoque m
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE t.codigo_tipo = 'SAIDA_VENDA';
    CALL audit_demo.registrar_verificacao(p_exec, 'MOV-04', 'Movimentação',
        'Presente/roubo/ajuste não aparecem em fato_venda_item; Σ unidades vendidas = Σ SAIDA_VENDA.',
        'não-venda em vendas=0; unidades iguais',
        format('não-venda em vendas=%s; vendidas=%s; saida_venda=%s', v_n, v_m, v_x), v_n = 0 AND v_m = v_x);

    -- SNP-01 — completude e unicidade
    SELECT count(*) INTO v_n FROM dw_demo.fato_snapshot_estoque;
    SELECT (SELECT count(*) FROM dw_demo.datas_referencia_snapshot()) * (SELECT count(*) FROM dw_demo.dim_produto) INTO v_m;
    SELECT count(*) INTO v_x
      FROM (SELECT produto_key, data_key FROM dw_demo.fato_snapshot_estoque GROUP BY 1, 2 HAVING count(*) > 1) d;
    CALL audit_demo.registrar_verificacao(p_exec, 'SNP-01', 'Snapshot',
        'Um snapshot por (produto, data de referência), para todos os produtos e datas.',
        format('linhas=%s; duplicados=0', v_m), format('linhas=%s; duplicados=%s', v_n, v_x), v_n = v_m AND v_x = 0);

    -- SNP-02 — reconciliação com as movimentações acumuladas
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_snapshot_estoque s
      JOIN dw_demo.dim_data d ON d.data_key = s.data_key
     WHERE s.quantidade_em_estoque <> coalesce((
            SELECT sum(m.quantidade * t.sinal)
              FROM dw_demo.fato_movimentacao_estoque m
              JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
             WHERE m.produto_key = s.produto_key AND m.data_hora_evento < (d.data + 1)::timestamp), 0);
    CALL audit_demo.registrar_verificacao(p_exec, 'SNP-02', 'Snapshot',
        'Snapshot = Σ(quantidade × sinal) acumulado até o fim da data (inclui SALDO_INICIAL).',
        '0', v_n::text, v_n = 0);

    -- SNP-03 — não negativo e último snapshot = saldo final do gerador
    SELECT count(*) INTO v_n FROM dw_demo.fato_snapshot_estoque WHERE quantidade_em_estoque < 0;
    SELECT count(*) INTO v_m
      FROM staging_demo.saldo_final_gerador g
      JOIN dw_demo.dim_produto p ON p.codigo_produto = g.codigo_produto
      LEFT JOIN dw_demo.fato_snapshot_estoque s
             ON s.produto_key = p.produto_key
            AND s.data_key = dw_demo.data_key(config_demo.param_data('data_fim'))
     WHERE g.id_execucao = p_exec
       AND s.quantidade_em_estoque IS DISTINCT FROM g.saldo_final;
    CALL audit_demo.registrar_verificacao(p_exec, 'SNP-03', 'Snapshot',
        'Saldos ≥ 0 e último snapshot igual ao saldo final mantido pelo gerador.',
        'negativos=0; divergências=0', format('negativos=%s; divergências=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- COM-01 — preço realizado > 0; diferença calculada nos dois sentidos
    SELECT count(*) FILTER (WHERE preco_vendido_realizado_unitario <= 0),
           count(*) FILTER (WHERE diferenca_marcado_realizado <> valor_marcado_total - valor_realizado_total),
           count(*) FILTER (WHERE diferenca_marcado_realizado > 0) * count(*) FILTER (WHERE diferenca_marcado_realizado < 0)
      INTO v_n, v_m, v_x
      FROM dw_demo.fato_venda_item;
    CALL audit_demo.registrar_verificacao(p_exec, 'COM-01', 'Comercial',
        'Realizado > 0, sem limite em relação ao marcado; diferença coerente; existem vendas abaixo e acima.',
        'realizado inválido=0; diferença incoerente=0; abaixo×acima>0',
        format('realizado inválido=%s; diferença incoerente=%s; abaixo×acima=%s', v_n, v_m, v_x),
        v_n = 0 AND v_m = 0 AND v_x > 0);

    -- COM-02 — proporções de cenário de preço dentro da tolerância
    SELECT avg(CASE WHEN preco_vendido_realizado_unitario = preco_venda_marcado_unitario THEN 1 ELSE 0 END),
           avg(CASE WHEN preco_vendido_realizado_unitario < preco_venda_marcado_unitario THEN 1 ELSE 0 END),
           avg(CASE WHEN preco_vendido_realizado_unitario > preco_venda_marcado_unitario THEN 1 ELSE 0 END)
      INTO v_s_igual, v_s_abaixo, v_s_acima
      FROM dw_demo.fato_venda_item;
    CALL audit_demo.registrar_verificacao(p_exec, 'COM-02', 'Comercial',
        'Proporções de vendas igual/abaixo/acima do marcado conforme configuração (± tolerância).',
        format('igual=%s; abaixo=%s; acima=%s (±%s)', v_p_igual, v_p_abaixo, 1 - v_p_igual - v_p_abaixo, v_tol),
        format('igual=%s; abaixo=%s; acima=%s', round(v_s_igual, 4), round(v_s_abaixo, 4), round(v_s_acima, 4)),
        abs(v_s_igual - v_p_igual) <= v_tol AND abs(v_s_abaixo - v_p_abaixo) <= v_tol
        AND abs(v_s_acima - (1 - v_p_igual - v_p_abaixo)) <= v_tol);

    -- COM-03 — faturamento = Σ quantidade × preço realizado
    SELECT count(*) INTO v_n FROM dw_demo.fato_venda_item
     WHERE valor_realizado_total <> quantidade_vendida * preco_vendido_realizado_unitario;
    SELECT coalesce(sum(valor_realizado_total), 0)::text INTO v_txt FROM dw_demo.fato_venda_item;
    CALL audit_demo.registrar_verificacao(p_exec, 'COM-03', 'Comercial',
        'Faturamento = Σ valor_realizado_total = Σ(quantidade × preço realizado).',
        'divergências=0', format('divergências=%s; faturamento total (sintético)=%s', v_n, v_txt), v_n = 0);

    -- SEP-01 — marcação sintética
    SELECT (SELECT count(*) FROM dw_demo.dim_produto WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.dim_data WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.dim_tipo_movimentacao WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.parametro_preco_ouro WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_compra_item WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_venda_item WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_movimentacao_estoque WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_snapshot_estoque WHERE origem_dado <> 'SINTETICO_DEMO')
      INTO v_n;
    CALL audit_demo.registrar_verificacao(p_exec, 'SEP-01', 'Separação',
        '100% das linhas de dw_demo com origem_dado = SINTETICO_DEMO.', '0', v_n::text, v_n = 0);

    -- SEP-02 — sem perfil técnico nem clientes nas views de consumo
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'bi_demo' AND (column_name ILIKE '%perfil%' OR column_name ILIKE '%cliente%');
    SELECT count(*) INTO v_m FROM information_schema.columns
     WHERE table_schema IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo') AND column_name ILIKE '%cliente%';
    CALL audit_demo.registrar_verificacao(p_exec, 'SEP-02', 'Separação',
        'bi_demo não expõe perfil técnico; nenhuma coluna de cliente nas schemas demo.',
        'perfil/cliente em bi_demo=0; cliente em schemas demo=0',
        format('perfil/cliente em bi_demo=%s; cliente em schemas demo=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- REP-01 — conteúdo do DW igual ao gerado nesta execução (idempotência sem divergência)
    SELECT (SELECT count(*) FROM staging_demo.entrada_gerada e
             WHERE e.id_execucao = p_exec
               AND NOT EXISTS (SELECT 1 FROM dw_demo.fato_compra_item c JOIN dw_demo.dim_produto p ON p.produto_key = c.produto_key
                                WHERE c.id_evento_origem = e.id_evento_origem AND p.codigo_produto = e.codigo_produto
                                  AND c.quantidade_recebida = e.quantidade_recebida AND c.custo_total_pago = e.custo_total_pago
                                  AND c.data_hora_entrada = e.data_hora_entrada
                                  AND c.preco_venda_marcado_unitario = e.preco_venda_marcado_unitario))
         + (SELECT count(*) FROM staging_demo.venda_gerada v
             WHERE v.id_execucao = p_exec
               AND NOT EXISTS (SELECT 1 FROM dw_demo.fato_venda_item f JOIN dw_demo.dim_produto p ON p.produto_key = f.produto_key
                                WHERE f.id_evento_origem = v.id_evento_origem AND p.codigo_produto = v.codigo_produto
                                  AND f.quantidade_vendida = v.quantidade_vendida AND f.data_hora_venda = v.data_hora_venda
                                  AND f.preco_venda_marcado_unitario = v.preco_venda_marcado_unitario
                                  AND f.preco_vendido_realizado_unitario = v.preco_vendido_realizado_unitario))
         + (SELECT count(*) FROM staging_demo.movimento_gerado m
             WHERE m.id_execucao = p_exec
               AND NOT EXISTS (SELECT 1 FROM dw_demo.fato_movimentacao_estoque f
                                JOIN dw_demo.dim_produto p ON p.produto_key = f.produto_key
                                JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = f.tipo_mov_key
                                WHERE f.id_evento_origem = m.id_evento_origem AND p.codigo_produto = m.codigo_produto
                                  AND t.codigo_tipo = m.codigo_tipo AND f.quantidade = m.quantidade
                                  AND f.data_hora_evento = m.data_hora_evento))
      INTO v_n;
    SELECT (SELECT count(*) FROM dw_demo.fato_compra_item c
             WHERE NOT EXISTS (SELECT 1 FROM staging_demo.entrada_gerada e WHERE e.id_execucao = p_exec AND e.id_evento_origem = c.id_evento_origem))
         + (SELECT count(*) FROM dw_demo.fato_venda_item f
             WHERE NOT EXISTS (SELECT 1 FROM staging_demo.venda_gerada v WHERE v.id_execucao = p_exec AND v.id_evento_origem = f.id_evento_origem))
         + (SELECT count(*) FROM dw_demo.fato_movimentacao_estoque f
             WHERE NOT EXISTS (SELECT 1 FROM staging_demo.movimento_gerado m WHERE m.id_execucao = p_exec AND m.id_evento_origem = f.id_evento_origem))
      INTO v_m;
    CALL audit_demo.registrar_verificacao(p_exec, 'REP-01', 'Reprocessamento',
        'Registros gerados nesta execução existem no DW com o mesmo conteúdo, e o DW não tem registros alheios a esta geração.',
        'staging divergente/ausente=0; DW sem correspondência=0',
        format('staging divergente/ausente=%s; DW sem correspondência=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- REP-02 — determinismo: mesmo md5 que a última execução bem-sucedida com o mesmo hash
    SELECT hash_configuracao INTO v_hash FROM audit_demo.execucao WHERE id_execucao = p_exec;
    v_md5_atual := staging_demo.md5_conteudo(p_exec);
    SELECT e.id_execucao INTO v_exec_ant
      FROM audit_demo.execucao e
     WHERE e.id_execucao < p_exec AND e.status = 'SUCESSO' AND e.hash_configuracao = v_hash
       AND EXISTS (SELECT 1 FROM staging_demo.produto_gerado p WHERE p.id_execucao = e.id_execucao)
     ORDER BY e.id_execucao DESC
     LIMIT 1;
    IF v_exec_ant IS NULL THEN
        CALL audit_demo.registrar_verificacao(p_exec, 'REP-02', 'Reprocessamento',
            'Mesma semente/configuração produz o mesmo conteúdo (md5).',
            'md5 igual ao de execução anterior com o mesmo hash',
            format('N/A: primeira execução com este hash (md5 %s)', v_md5_atual), true);
    ELSE
        v_md5_ant := staging_demo.md5_conteudo(v_exec_ant);
        CALL audit_demo.registrar_verificacao(p_exec, 'REP-02', 'Reprocessamento',
            'Mesma semente/configuração produz o mesmo conteúdo (md5).',
            format('md5 da execução %s = %s', v_exec_ant, v_md5_ant),
            format('md5 desta execução = %s', v_md5_atual), v_md5_atual = v_md5_ant);
    END IF;

    -- REJ-01 — nenhuma rejeição esperada na demo
    SELECT count(*) INTO v_n FROM audit_demo.rejeicao WHERE id_execucao = p_exec;
    CALL audit_demo.registrar_verificacao(p_exec, 'REJ-01', 'Qualidade',
        'Nenhuma rejeição na geração demonstrativa (rejeição indica defeito do gerador).',
        '0', v_n::text, v_n = 0);

    SELECT count(*) INTO v_falhas FROM audit_demo.resultado_validacao WHERE id_execucao = p_exec AND NOT aprovado;
    -- Subconsultas não são aceitas em argumentos de CALL: contagem antecipada.
    SELECT count(*) INTO v_n FROM audit_demo.resultado_validacao WHERE id_execucao = p_exec;
    CALL audit_demo.registrar_etapa(p_exec, 'verificacoes_qualidade', v_inicio,
        v_n, NULL, v_falhas,
        CASE WHEN v_falhas = 0 THEN 'Todas as verificações aprovadas.' ELSE 'Há verificações reprovadas.' END);
    RETURN v_falhas;
END;
$$;
