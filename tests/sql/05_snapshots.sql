-- =============================================================================
-- 05_snapshots.sql — snapshots mensais calculados a partir das movimentações.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n bigint;
    v_esperado bigint;
BEGIN
    SELECT (SELECT count(*) FROM dw_demo.datas_referencia_snapshot()) * (SELECT count(*) FROM dw_demo.dim_produto)
      INTO v_esperado;
    SELECT count(*) INTO v_n FROM dw_demo.fato_snapshot_estoque;
    IF v_n <> v_esperado THEN
        RAISE EXCEPTION 'FALHA [SNP-01]: esperado % snapshots (datas × produtos), obtido %', v_esperado, v_n;
    END IF;

    -- Datas de referência = último dia de cada mês (e data_fim).
    SELECT count(*) INTO v_n
      FROM (SELECT DISTINCT d.data FROM dw_demo.fato_snapshot_estoque s JOIN dw_demo.dim_data d ON d.data_key = s.data_key) x
     WHERE x.data <> (date_trunc('month', x.data) + interval '1 month' - interval '1 day')::date
       AND x.data <> config_demo.param_data('data_fim');
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SNP-01b]: % data(s) de snapshot fora do fim de mês', v_n; END IF;

    SELECT count(*) INTO v_n
      FROM dw_demo.fato_snapshot_estoque s
      JOIN dw_demo.dim_data d ON d.data_key = s.data_key
     WHERE s.quantidade_em_estoque <> coalesce((
            SELECT sum(m.quantidade * t.sinal)
              FROM dw_demo.fato_movimentacao_estoque m
              JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
             WHERE m.produto_key = s.produto_key AND m.data_hora_evento < (d.data + 1)::timestamp), 0);
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SNP-02]: % snapshot(s) não reconciliam com as movimentações', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.fato_snapshot_estoque WHERE quantidade_em_estoque < 0;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SNP-03]: % snapshot(s) negativo(s)', v_n; END IF;

    -- Há produtos com saldo zero em alguma data (rupturas visíveis) e produtos parados com estoque.
    IF NOT EXISTS (SELECT 1 FROM dw_demo.fato_snapshot_estoque WHERE quantidade_em_estoque = 0) THEN
        RAISE NOTICE 'AVISO [SNP-04]: nenhum snapshot com saldo zero (não é falha; depende da configuração)';
    END IF;

    RAISE NOTICE 'OK 05_snapshots';
END;
$$;

ROLLBACK;
