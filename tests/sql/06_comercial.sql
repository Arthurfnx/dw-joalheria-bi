-- =============================================================================
-- 06_comercial.sql — faturamento pelo preço realizado; preço realizado sem
-- restrição em relação ao marcado; vendas abaixo, iguais e acima existem.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n      bigint;
    v_abaixo bigint;
    v_igual  bigint;
    v_acima  bigint;
BEGIN
    SELECT count(*) INTO v_n FROM dw_demo.fato_venda_item
     WHERE valor_realizado_total <> quantidade_vendida * preco_vendido_realizado_unitario
        OR valor_marcado_total <> quantidade_vendida * preco_venda_marcado_unitario
        OR diferenca_marcado_realizado <> valor_marcado_total - valor_realizado_total;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [COM-03]: % item(ns) com totais incoerentes', v_n; END IF;

    SELECT count(*) FILTER (WHERE preco_vendido_realizado_unitario < preco_venda_marcado_unitario),
           count(*) FILTER (WHERE preco_vendido_realizado_unitario = preco_venda_marcado_unitario),
           count(*) FILTER (WHERE preco_vendido_realizado_unitario > preco_venda_marcado_unitario)
      INTO v_abaixo, v_igual, v_acima
      FROM dw_demo.fato_venda_item;
    IF v_abaixo = 0 OR v_igual = 0 OR v_acima = 0 THEN
        RAISE EXCEPTION 'FALHA [COM-01]: cenários incompletos (abaixo=%, igual=%, acima=%)', v_abaixo, v_igual, v_acima;
    END IF;

    -- Não pode existir restrição permanente "realizado <= marcado".
    SELECT count(*) INTO v_n
      FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace s ON s.oid = c.relnamespace
     WHERE s.nspname = 'dw_demo' AND c.relname = 'fato_venda_item' AND k.contype = 'c'
       AND pg_get_constraintdef(k.oid) LIKE '%preco_vendido_realizado_unitario%preco_venda_marcado_unitario%';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [COM-04]: existe restrição entre preço realizado e marcado'; END IF;

    -- Identificadores de venda são sintéticos e agrupam itens.
    SELECT count(*) INTO v_n FROM dw_demo.fato_venda_item WHERE id_venda_sintetica !~ '^DEMO-VND-[0-9]{6}$';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [COM-05]: % id(s) de venda fora do padrão sintético', v_n; END IF;
    IF NOT EXISTS (SELECT 1 FROM dw_demo.fato_venda_item GROUP BY id_venda_sintetica HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'FALHA [COM-06]: nenhuma venda com mais de um item (associação inviável)';
    END IF;

    -- A view de associação produz métricas no intervalo esperado.
    SELECT count(*) INTO v_n FROM bi_demo.vw_associacao_tipos
     WHERE suporte NOT BETWEEN 0 AND 1 OR confianca NOT BETWEEN 0 AND 1 OR lift <= 0;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [COM-07]: % par(es) com métricas de associação fora do intervalo', v_n; END IF;

    RAISE NOTICE 'OK 06_comercial (abaixo=%, igual=%, acima=%)', v_abaixo, v_igual, v_acima;
END;
$$;

ROLLBACK;
