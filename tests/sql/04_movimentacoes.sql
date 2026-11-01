-- =============================================================================
-- 04_movimentacoes.sql — quantidade positiva, sinal pelo tipo, reconciliação
-- compra/venda ↔ movimentação (1:1) e saídas não comerciais fora das vendas.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n bigint;
    v_m bigint;
BEGIN
    SELECT count(*) INTO v_n FROM dw_demo.fato_movimentacao_estoque WHERE quantidade <= 0;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-01]: % movimentação(ões) com quantidade não positiva', v_n; END IF;

    -- Tipos fundamentais presentes na simulação padrão. SAIDA_ROUBO não é exigido
    -- (roubos desativados nesta fase; o tipo permanece na dimensão).
    SELECT count(DISTINCT t.codigo_tipo) INTO v_n
      FROM dw_demo.fato_movimentacao_estoque m
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE t.codigo_tipo IN ('SALDO_INICIAL', 'ENTRADA_COMPRA', 'SAIDA_VENDA');
    IF v_n <> 3 THEN
        RAISE EXCEPTION 'FALHA [MOV-00]: esperados SALDO_INICIAL, ENTRADA_COMPRA e SAIDA_VENDA; presentes %', v_n;
    END IF;

    -- Venda ↔ SAIDA_VENDA (1:1, mesmos produto, data/hora e quantidade).
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_venda_item v
      FULL JOIN (SELECT m.* FROM dw_demo.fato_movimentacao_estoque m
                   JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
                  WHERE t.codigo_tipo = 'SAIDA_VENDA') m
        ON m.id_evento_origem = v.id_evento_origem
     WHERE v.venda_item_key IS NULL OR m.movimentacao_key IS NULL
        OR m.produto_key <> v.produto_key OR m.data_hora_evento <> v.data_hora_venda
        OR m.quantidade <> v.quantidade_vendida;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-02]: % divergência(s) venda ↔ SAIDA_VENDA', v_n; END IF;

    -- Compra ↔ ENTRADA_COMPRA (1:1).
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_compra_item c
      FULL JOIN (SELECT m.* FROM dw_demo.fato_movimentacao_estoque m
                   JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
                  WHERE t.codigo_tipo = 'ENTRADA_COMPRA') m
        ON m.id_evento_origem = c.id_evento_origem
     WHERE c.compra_item_key IS NULL OR m.movimentacao_key IS NULL
        OR m.produto_key <> c.produto_key OR m.data_hora_evento <> c.data_hora_entrada
        OR m.quantidade <> c.quantidade_recebida;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-03]: % divergência(s) compra ↔ ENTRADA_COMPRA', v_n; END IF;

    -- Presentes, roubos e ajustes não geram registros comerciais.
    SELECT count(*) INTO v_n
      FROM dw_demo.fato_movimentacao_estoque m
      JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
     WHERE t.codigo_tipo IN ('SAIDA_PRESENTE', 'SAIDA_ROUBO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'SALDO_INICIAL')
       AND (EXISTS (SELECT 1 FROM dw_demo.fato_venda_item v WHERE v.id_evento_origem = m.id_evento_origem)
         OR EXISTS (SELECT 1 FROM dw_demo.fato_compra_item c WHERE c.id_evento_origem = m.id_evento_origem));
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-04]: % saída/ajuste não comercial com registro comercial', v_n; END IF;

    -- Saldo final = Σ(quantidade × sinal) — nunca negativo por produto.
    SELECT count(*) INTO v_n
      FROM (SELECT m.produto_key, sum(m.quantidade * t.sinal) AS saldo
              FROM dw_demo.fato_movimentacao_estoque m
              JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key
             GROUP BY m.produto_key) s
     WHERE s.saldo < 0;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-05]: % produto(s) com saldo final negativo', v_n; END IF;

    -- Saldo nunca negativo em nenhum instante (acumulado em ordem temporal).
    SELECT count(*) INTO v_m
      FROM (SELECT sum(m.quantidade * t.sinal) OVER (PARTITION BY m.produto_key
                                                     ORDER BY m.data_hora_evento, m.movimentacao_key) AS saldo
              FROM dw_demo.fato_movimentacao_estoque m
              JOIN dw_demo.dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key) x
     WHERE x.saldo < 0;
    IF v_m <> 0 THEN RAISE EXCEPTION 'FALHA [MOV-06]: % instante(s) com saldo acumulado negativo', v_m; END IF;

    RAISE NOTICE 'OK 04_movimentacoes';
END;
$$;

ROLLBACK;
