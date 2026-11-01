-- =============================================================================
-- 07_separacao.sql — marcação SINTETICO_DEMO, ausência de clientes e de
-- atributos técnicos nas views de consumo, aviso do ambiente.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n bigint;
BEGIN
    SELECT (SELECT count(*) FROM dw_demo.dim_produto WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_compra_item WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_venda_item WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_movimentacao_estoque WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.fato_snapshot_estoque WHERE origem_dado <> 'SINTETICO_DEMO')
         + (SELECT count(*) FROM dw_demo.parametro_preco_ouro WHERE origem_dado <> 'SINTETICO_DEMO')
      INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SEP-01]: % linha(s) sem marcação SINTETICO_DEMO', v_n; END IF;

    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo') AND column_name ILIKE '%cliente%';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SEP-02a]: % coluna(s) de cliente nas schemas demo', v_n; END IF;

    SELECT count(*) INTO v_n FROM information_schema.tables
     WHERE table_schema IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo') AND table_name ILIKE '%cliente%';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SEP-02b]: tabela/view de cliente nas schemas demo'; END IF;

    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'bi_demo' AND column_name ILIKE '%perfil%';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SEP-02c]: bi_demo expõe perfil técnico do gerador'; END IF;

    IF (SELECT aviso FROM bi_demo.vw_info_ambiente)
       <> 'AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.' THEN
        RAISE EXCEPTION 'FALHA [SEP-03]: aviso obrigatório ausente ou divergente em bi_demo.vw_info_ambiente';
    END IF;

    -- Nenhum código no formato das planilhas reais (sem reaproveitamento de códigos reais).
    SELECT count(*) INTO v_n FROM dw_demo.dim_produto
     WHERE codigo_produto ~ '^R[0-9]+' OR codigo_produto ~ '^[0-9]+-[0-9]+$' OR codigo_produto ~ '^[0-9]{4}$';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [SEP-04]: código em formato de planilha real'; END IF;

    RAISE NOTICE 'OK 07_separacao';
END;
$$;

ROLLBACK;
