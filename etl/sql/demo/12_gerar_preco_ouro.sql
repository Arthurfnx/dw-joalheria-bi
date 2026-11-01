-- =============================================================================
-- 12_gerar_preco_ouro.sql — série SINTÉTICA do preço do ouro 1000, um valor
-- por dia do período (passeio aleatório determinístico).
-- unidade_referencia = 'NAO_CONFIRMADA_DEMO': NÃO é cotação oficial e NÃO deve
-- ser interpretada como preço por grama.
-- =============================================================================

CREATE OR REPLACE PROCEDURE staging_demo.gerar_preco_ouro(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sem    bigint  := config_demo.param_inteiro('semente');
    v_ini    date    := config_demo.param_data('data_inicio');
    v_fim    date    := config_demo.param_data('data_fim');
    v_var    numeric := config_demo.param_decimal('preco_ouro_variacao_diaria_max');
    v_preco  numeric := config_demo.param_decimal('preco_ouro_base');
    v_dia    date    := v_ini;
BEGIN
    WHILE v_dia <= v_fim LOOP
        IF v_dia > v_ini THEN
            v_preco := v_preco * (1 + config_demo.rand_entre(v_sem, 'preco_ouro|' || v_dia::text, 0, -v_var, v_var));
        END IF;
        INSERT INTO staging_demo.preco_ouro_gerado (id_execucao, data_referencia, preco_ouro_1000, unidade_referencia)
        VALUES (p_exec, v_dia, round(v_preco, 2), 'NAO_CONFIRMADA_DEMO');
        v_dia := v_dia + 1;
    END LOOP;
END;
$$;
