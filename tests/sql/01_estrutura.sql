-- =============================================================================
-- 01_estrutura.sql — schemas, tabelas, colunas geradas e ausência de schemas reais.
-- Executado dentro de transação com ROLLBACK (não altera o banco).
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n integer;
BEGIN
    SELECT count(*) INTO v_n FROM pg_namespace
     WHERE nspname IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo', 'audit_demo');
    IF v_n <> 5 THEN
        RAISE EXCEPTION 'FALHA [EST-01a]: esperado 5 schemas demo, obtido %', v_n;
    END IF;

    SELECT count(*) INTO v_n FROM pg_namespace WHERE nspname IN ('staging', 'dw', 'bi', 'audit');
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'FALHA [EST-01b]: schemas do ambiente real não devem existir na fase 1 (encontradas %)', v_n;
    END IF;

    SELECT count(*) INTO v_n
      FROM unnest(ARRAY['dim_produto', 'dim_data', 'dim_tipo_movimentacao', 'parametro_preco_ouro',
                        'fato_compra_item', 'fato_venda_item', 'fato_movimentacao_estoque',
                        'fato_snapshot_estoque', 'controle_carga']) AS t(nome)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'dw_demo' AND table_name = t.nome);
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'FALHA [EST-02a]: % tabela(s) de dw_demo ausente(s)', v_n;
    END IF;

    -- Movimentação: uma única medida de quantidade (sem colunas assinadas/absolutas redundantes).
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'dw_demo' AND table_name = 'fato_movimentacao_estoque'
       AND column_name IN ('quantidade_absoluta', 'quantidade_assinada');
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'FALHA [EST-02b]: fato_movimentacao_estoque deve ter apenas a medida quantidade';
    END IF;

    -- perfil técnico não pode estar em dim_produto.
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'dw_demo' AND table_name = 'dim_produto' AND column_name ILIKE '%perfil%';
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'FALHA [EST-02c]: dim_produto não deve conter perfil de movimentação';
    END IF;

    -- Colunas derivadas devem ser STORED (PostgreSQL 18 usa VIRTUAL por padrão).
    SELECT count(*) INTO v_n FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace s ON s.oid = c.relnamespace
     WHERE s.nspname = 'dw_demo'
       AND a.attname IN ('custo_unitario', 'valor_marcado_total', 'valor_realizado_total', 'diferenca_marcado_realizado')
       AND a.attgenerated = 's';
    IF v_n <> 4 THEN
        RAISE EXCEPTION 'FALHA [EST-02d]: esperadas 4 colunas geradas STORED, obtidas %', v_n;
    END IF;

    -- Domínio de tipos de movimentação com sinais acordados.
    SELECT count(*) INTO v_n FROM dw_demo.dim_tipo_movimentacao
     WHERE (codigo_tipo, sinal, eh_venda) IN (
            ('SALDO_INICIAL', 1, false), ('ENTRADA_COMPRA', 1, false), ('SAIDA_VENDA', -1, true),
            ('SAIDA_PRESENTE', -1, false), ('SAIDA_ROUBO', -1, false),
            ('AJUSTE_POSITIVO', 1, false), ('AJUSTE_NEGATIVO', -1, false));
    IF v_n <> 7 OR (SELECT count(*) FROM dw_demo.dim_tipo_movimentacao) <> 7 THEN
        RAISE EXCEPTION 'FALHA [EST-02e]: domínio de dim_tipo_movimentacao divergente do acordado';
    END IF;

    RAISE NOTICE 'OK 01_estrutura';
END;
$$;

ROLLBACK;
