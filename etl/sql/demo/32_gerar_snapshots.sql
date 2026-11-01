-- =============================================================================
-- 32_gerar_snapshots.sql — fato_snapshot_estoque calculado a partir das
-- movimentações (inclui SALDO_INICIAL).
--   Datas de referência: último dia de cada mês do período + data_fim.
--   Saldo = Σ(quantidade × sinal) com data_hora_evento < data_referência + 1 dia.
--   Todos os produtos em todas as datas (inclusive saldo 0).
-- =============================================================================

CREATE OR REPLACE FUNCTION dw_demo.datas_referencia_snapshot()
RETURNS TABLE (data_referencia date)
LANGUAGE sql STABLE
AS $$
    SELECT DISTINCT x.d
      FROM (SELECT (date_trunc('month', g.m) + interval '1 month' - interval '1 day')::date AS d
              FROM generate_series(date_trunc('month', config_demo.param_data('data_inicio')::timestamp),
                                   config_demo.param_data('data_fim')::timestamp,
                                   interval '1 month') AS g(m)
            UNION
            SELECT config_demo.param_data('data_fim')) x
     WHERE x.d BETWEEN config_demo.param_data('data_inicio') AND config_demo.param_data('data_fim')
     ORDER BY x.d
$$;

CREATE OR REPLACE PROCEDURE dw_demo.gerar_snapshots(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio  timestamptz := clock_timestamp();
    v_lidas   bigint;
    v_carg    bigint;
BEGIN
    SELECT count(*) * (SELECT count(*) FROM dw_demo.dim_produto) INTO v_lidas
      FROM dw_demo.datas_referencia_snapshot();

    INSERT INTO dw_demo.fato_snapshot_estoque (data_key, produto_key, quantidade_em_estoque, id_execucao)
    SELECT dw_demo.data_key(r.data_referencia),
           p.produto_key,
           coalesce((SELECT sum(m.quantidade * t.sinal)
                       FROM dw_demo.fato_movimentacao_estoque m
                       JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
                      WHERE m.produto_key = p.produto_key
                        AND m.data_hora_evento < (r.data_referencia + 1)::timestamp), 0)::integer,
           p_exec
      FROM dw_demo.datas_referencia_snapshot() r
     CROSS JOIN dw_demo.dim_produto p
     ORDER BY r.data_referencia, p.produto_key
    ON CONFLICT (produto_key, data_key) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;

    CALL audit_demo.registrar_etapa(p_exec, 'gerar_snapshots', v_inicio, v_lidas, v_carg, 0,
        'Linhas novas; snapshots já existentes (produto, data) são mantidos.');
END;
$$;
