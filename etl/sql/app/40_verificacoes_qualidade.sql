-- =============================================================================
-- 40_verificacoes_qualidade.sql — verificações de qualidade do ETL real.
-- Resultado em audit.resultado_validacao; devolve o número de verificações
-- reprovadas. scripts/run_etl_app.ps1 encerra a execução como FALHA (e com
-- código de saída diferente de zero) se alguma for reprovada.
-- =============================================================================

CREATE OR REPLACE FUNCTION audit.executar_verificacoes(p_exec bigint)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_ref    date;
    v_fator  numeric;
    v_n      bigint;
    v_m      bigint;
    v_x      bigint;
    v_txt    text;
BEGIN
    SELECT data_referencia, fator_preco_ouro INTO v_ref, v_fator FROM dw.controle_carga WHERE id = 1;

    -- QLD-01 — cada CSV carregado tem as mesmas linhas contadas na origem -------
    SELECT count(*), string_agg(format('%s: origem %s, staging %s', e.tabela, e.linhas, s.n), '; ' ORDER BY e.tabela)
      INTO v_n, v_txt
      FROM staging.extracao e
      JOIN LATERAL (
            SELECT CASE e.tabela
                WHEN 'produto'              THEN (SELECT count(*) FROM staging.produto)
                WHEN 'tipo_movimentacao'    THEN (SELECT count(*) FROM staging.tipo_movimentacao)
                WHEN 'venda'                THEN (SELECT count(*) FROM staging.venda)
                WHEN 'venda_item'           THEN (SELECT count(*) FROM staging.venda_item)
                WHEN 'venda_historica'      THEN (SELECT count(*) FROM staging.venda_historica)
                WHEN 'preco_ouro'           THEN (SELECT count(*) FROM staging.preco_ouro)
                WHEN 'movimentacao_estoque' THEN (SELECT count(*) FROM staging.movimentacao_estoque)
                WHEN 'saldo_estoque'        THEN (SELECT count(*) FROM staging.saldo_estoque)
                WHEN 'importacao_lote'      THEN (SELECT count(*) FROM staging.importacao_lote)
                WHEN 'configuracao'         THEN (SELECT count(*) FROM staging.configuracao)
            END AS n
           ) s ON true
     WHERE s.n IS DISTINCT FROM e.linhas;
    SELECT count(*) INTO v_m FROM staging.extracao;
    CALL audit.registrar_verificacao(p_exec, 'QLD-01', 'Contagens',
        'Origem × staging: cada tabela extraída tem na staging as linhas contadas no banco operacional.',
        'divergências=0; tabelas=10', format('divergências=%s; tabelas=%s%s', v_n, v_m, coalesce(' — ' || v_txt, '')),
        v_n = 0 AND v_m = 10);

    -- QLD-02 — produtos ------------------------------------------------------------
    SELECT linhas INTO v_n FROM staging.extracao WHERE tabela = 'produto';
    SELECT count(*) INTO v_m FROM dw.dim_produto;
    CALL audit.registrar_verificacao(p_exec, 'QLD-02', 'Contagens',
        'Produtos em dim_produto = produtos da aplicação.',
        v_n::text, v_m::text, v_n = v_m);

    -- QLD-03 — vendas da planilha ----------------------------------------------------
    SELECT linhas INTO v_n FROM staging.extracao WHERE tabela = 'venda_historica';
    SELECT count(*) INTO v_m FROM dw.fato_venda_item WHERE origem_dado = 'PLANILHA';
    CALL audit.registrar_verificacao(p_exec, 'QLD-03', 'Contagens',
        'Vendas PLANILHA em fato_venda_item = registros de venda_historica.',
        v_n::text, v_m::text, v_n = v_m);

    -- QLD-04 — vendas da aplicação ---------------------------------------------------
    SELECT count(*) INTO v_n
      FROM staging.venda_item i JOIN staging.venda v ON v.id = i.venda_id
     WHERE v.situacao = 'CONFIRMADA';
    SELECT count(*), count(DISTINCT id_venda) INTO v_m, v_x FROM dw.fato_venda_item WHERE origem_dado = 'APLICACAO';
    SELECT count(*) INTO v_txt FROM staging.venda WHERE situacao = 'CONFIRMADA';
    CALL audit.registrar_verificacao(p_exec, 'QLD-04', 'Contagens',
        'Itens APLICACAO = itens de vendas confirmadas; vendas distintas = vendas confirmadas (canceladas fora).',
        format('itens=%s; vendas=%s', v_n, v_txt), format('itens=%s; vendas=%s', v_m, v_x),
        v_n = v_m AND v_x = v_txt::bigint);

    -- QLD-05 — compras ----------------------------------------------------------------
    SELECT count(*) INTO v_n FROM staging.produto WHERE data_aquisicao IS NOT NULL;
    SELECT count(*) INTO v_m FROM dw.fato_compra_item;
    SELECT count(*) INTO v_x FROM dw.fato_compra_item f JOIN dw.dim_produto p USING (produto_key)
     WHERE f.origem_dado = 'PLANILHA' AND p.origem_dado <> 'PLANILHA';
    CALL audit.registrar_verificacao(p_exec, 'QLD-05', 'Contagens',
        'Compras = produtos com data de aquisição (quantidade 1 cada); origem da compra = origem da peça.',
        format('%s; origem divergente=0', v_n), format('%s; origem divergente=%s', v_m, v_x), v_n = v_m AND v_x = 0);

    -- QLD-06 — movimentações e preço do ouro --------------------------------------------
    SELECT linhas INTO v_n FROM staging.extracao WHERE tabela = 'movimentacao_estoque';
    SELECT count(*) INTO v_m FROM dw.fato_movimentacao_estoque;
    SELECT linhas INTO v_x FROM staging.extracao WHERE tabela = 'preco_ouro';
    SELECT count(*) INTO v_txt FROM dw.parametro_preco_ouro;
    CALL audit.registrar_verificacao(p_exec, 'QLD-06', 'Contagens',
        'Movimentações e registros do preço do ouro: origem = DW.',
        format('movimentações=%s; preço do ouro=%s', v_n, v_x), format('movimentações=%s; preço do ouro=%s', v_m, v_txt),
        v_n = v_m AND v_x = v_txt::bigint);

    -- EST-01 — snapshot do último dia = saldo atual da aplicação -------------------------
    SELECT count(*) INTO v_n
      FROM dw.dim_produto p
      LEFT JOIN staging.saldo_estoque s ON s.produto_id = p.produto_key
      LEFT JOIN dw.fato_snapshot_estoque f ON f.produto_key = p.produto_key AND f.data_key = dw.data_key(v_ref)
     WHERE f.quantidade_em_estoque IS DISTINCT FROM coalesce(s.quantidade, 0);
    SELECT coalesce(sum(quantidade), 0) INTO v_m FROM staging.saldo_estoque;
    SELECT coalesce(sum(quantidade_em_estoque), 0) INTO v_x FROM dw.fato_snapshot_estoque WHERE data_key = dw.data_key(v_ref);
    CALL audit.registrar_verificacao(p_exec, 'EST-01', 'Estoque',
        format('Snapshot de %s (último dia) = saldo atual da aplicação, produto a produto.', v_ref),
        format('divergências=0; total=%s', v_m), format('divergências=%s; total=%s', v_n, v_x), v_n = 0 AND v_m = v_x);

    -- EST-02 — saldo = Σ(quantidade × sinal) das movimentações (I2) ------------------------
    SELECT count(*) INTO v_n
      FROM dw.dim_produto p
      LEFT JOIN staging.saldo_estoque s ON s.produto_id = p.produto_key
      LEFT JOIN (SELECT f.produto_key, sum(f.quantidade * t.sinal) AS saldo
                   FROM dw.fato_movimentacao_estoque f JOIN dw.dim_tipo_movimentacao t USING (tipo_mov_key)
                  GROUP BY f.produto_key) m ON m.produto_key = p.produto_key
     WHERE coalesce(m.saldo, 0) <> coalesce(s.quantidade, 0);
    CALL audit.registrar_verificacao(p_exec, 'EST-02', 'Estoque',
        'Para todo produto, Σ(quantidade × sinal) das movimentações = saldo da aplicação.',
        '0', v_n::text, v_n = 0);

    -- EST-03 — snapshots só a partir da importação; nenhum negativo -----------------------
    SELECT count(*) INTO v_n FROM dw.fato_snapshot_estoque f JOIN dw.dim_data d USING (data_key)
     WHERE d.data < (SELECT data_inicio_estoque FROM dw.controle_carga WHERE id = 1) OR d.data > v_ref;
    SELECT count(*) INTO v_m FROM dw.fato_snapshot_estoque WHERE quantidade_em_estoque < 0;
    CALL audit.registrar_verificacao(p_exec, 'EST-03', 'Estoque',
        'Snapshots só entre a data da importação e a referência; nenhum saldo negativo.',
        'fora do intervalo=0; negativos=0', format('fora do intervalo=%s; negativos=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- ORF-01 — nenhuma linha órfã -------------------------------------------------------------
    SELECT (SELECT count(*) FROM dw.fato_venda_item f WHERE NOT EXISTS (SELECT 1 FROM dw.dim_produto p WHERE p.produto_key = f.produto_key)
                                                        OR NOT EXISTS (SELECT 1 FROM dw.dim_data d WHERE d.data_key = f.data_key))
         + (SELECT count(*) FROM dw.fato_compra_item f WHERE NOT EXISTS (SELECT 1 FROM dw.dim_produto p WHERE p.produto_key = f.produto_key)
                                                        OR NOT EXISTS (SELECT 1 FROM dw.dim_data d WHERE d.data_key = f.data_key))
         + (SELECT count(*) FROM dw.fato_movimentacao_estoque f WHERE NOT EXISTS (SELECT 1 FROM dw.dim_produto p WHERE p.produto_key = f.produto_key)
                                                        OR NOT EXISTS (SELECT 1 FROM dw.dim_tipo_movimentacao t WHERE t.tipo_mov_key = f.tipo_mov_key)
                                                        OR NOT EXISTS (SELECT 1 FROM dw.dim_data d WHERE d.data_key = f.data_key))
         + (SELECT count(*) FROM dw.fato_snapshot_estoque f WHERE NOT EXISTS (SELECT 1 FROM dw.dim_produto p WHERE p.produto_key = f.produto_key))
         + (SELECT count(*) FROM dw.dim_produto p WHERE NOT EXISTS (SELECT 1 FROM dw.fato_snapshot_estoque f
                                                     WHERE f.produto_key = p.produto_key AND f.data_key = dw.data_key(v_ref)))
      INTO v_n;
    CALL audit.registrar_verificacao(p_exec, 'ORF-01', 'Integridade',
        'Nenhum fato sem produto, data ou tipo; todo produto tem posição no último dia.', '0', v_n::text, v_n = 0);

    -- VDA-01 — faturamento sem valor simbólico; identificador só nas vendas da aplicação ----
    SELECT count(*) FILTER (WHERE valor_simbolico AND entra_faturamento),
           count(*) FILTER (WHERE (origem_dado = 'APLICACAO') <> (id_venda IS NOT NULL))
      INTO v_n, v_m FROM dw.fato_venda_item;
    CALL audit.registrar_verificacao(p_exec, 'VDA-01', 'Vendas',
        'Valor simbólico fora do faturamento; número de venda presente só nas vendas APLICACAO.',
        'simbólico faturado=0; identificador incoerente=0',
        format('simbólico faturado=%s; identificador incoerente=%s', v_n, v_m), v_n = 0 AND v_m = 0);

    -- VDA-02 — associação e ticket médio só com vendas da aplicação (RN-73) ----------------
    SELECT count(DISTINCT id_venda) INTO v_n FROM dw.fato_venda_item WHERE origem_dado = 'APLICACAO';
    SELECT coalesce(max(total_vendas), v_n) INTO v_m FROM bi.vw_associacao_produtos;
    SELECT coalesce(max(total_vendas), v_n) INTO v_x FROM bi.vw_associacao_tipos;
    SELECT count(*) INTO v_txt FROM bi.vw_associacao_produtos WHERE origem_dado <> 'APLICACAO';
    CALL audit.registrar_verificacao(p_exec, 'VDA-02', 'Vendas',
        'Associação calculada só com vendas APLICACAO (RN-73): total de vendas = vendas distintas da aplicação.',
        format('vendas da aplicação=%s', v_n),
        format('produtos=%s; tipos=%s; linhas de outra origem=%s', v_m, v_x, v_txt),
        v_m = v_n AND v_x = v_n AND v_txt::bigint = 0);

    -- PRC-01 — preço sugerido do DW = RN-68 reconstruída -----------------------------------
    SELECT count(*) INTO v_n
      FROM dw.dim_produto p
      LEFT JOIN LATERAL (
            SELECT o.preco_ouro_1000 FROM dw.parametro_preco_ouro o
             WHERE o.vigente AND o.data_referencia <= v_ref
             ORDER BY o.data_referencia DESC LIMIT 1
           ) o ON true
     WHERE p.preco_sugerido_atual IS DISTINCT FROM
           CASE WHEN p.material = 'Ouro' AND p.indice_precificacao IS NOT NULL
                     AND o.preco_ouro_1000 IS NOT NULL AND v_fator IS NOT NULL
                THEN round(o.preco_ouro_1000 * v_fator * p.indice_precificacao, 2) END;
    CALL audit.registrar_verificacao(p_exec, 'PRC-01', 'Precificação',
        'Preço sugerido atual (app.preco_sugerido) = preço do ouro vigente × fator × índice, só para Ouro (RN-68).',
        '0', v_n::text, v_n = 0);

    -- PRV-01 — nenhuma coluna de pessoa no DW ---------------------------------------------
    SELECT count(*), string_agg(table_schema || '.' || table_name || '.' || column_name, ', ')
      INTO v_n, v_txt
      FROM information_schema.columns
     WHERE table_schema IN ('staging', 'dw', 'bi')
       AND (column_name ~* '(consign|cliente|local_original|usuario|vendedor|pessoa)' OR column_name ~* '^nome$');
    CALL audit.registrar_verificacao(p_exec, 'PRV-01', 'Privacidade',
        'Nenhuma coluna de nome de pessoa, cliente, usuário ou vendedor em staging, dw e bi.',
        '0', format('%s%s', v_n, coalesce(' — ' || v_txt, '')), v_n = 0);

    SELECT count(*) INTO v_n FROM audit.resultado_validacao WHERE id_execucao = p_exec AND NOT aprovado;
    RETURN v_n;
END;
$$;
