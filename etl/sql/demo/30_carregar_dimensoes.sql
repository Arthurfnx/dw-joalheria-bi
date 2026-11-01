-- =============================================================================
-- 30_carregar_dimensoes.sql — dim_data, dim_produto e parametro_preco_ouro.
-- dim_tipo_movimentacao é domínio fixo (semeada na migration 005).
-- Cargas idempotentes: ON CONFLICT DO NOTHING / NOT EXISTS.
-- =============================================================================

CREATE OR REPLACE PROCEDURE dw_demo.carregar_dimensoes(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio   timestamptz;
    v_ini      date := config_demo.param_data('data_inicio');
    v_fim      date := config_demo.param_data('data_fim');
    v_lidas    bigint;
    v_carg     bigint;
    v_rej      bigint;   -- rejeições (subconsultas não são aceitas em argumentos de CALL)
BEGIN
    -- ------------------------------------------------------------- dim_data
    v_inicio := clock_timestamp();
    INSERT INTO dw_demo.dim_data
        (data_key, data, dia, mes, nome_mes, trimestre, ano, ano_mes, dia_semana, nome_dia_semana,
         fim_de_semana, data_comercial, janela_comercial)
    SELECT dw_demo.data_key(d),
           d,
           EXTRACT(DAY FROM d)::smallint,
           EXTRACT(MONTH FROM d)::smallint,
           (ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
                  'Setembro','Outubro','Novembro','Dezembro'])[EXTRACT(MONTH FROM d)::integer],
           EXTRACT(QUARTER FROM d)::smallint,
           EXTRACT(YEAR FROM d)::smallint,
           to_char(d, 'YYYY-MM'),
           EXTRACT(ISODOW FROM d)::smallint,
           (ARRAY['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira',
                  'sábado','domingo'])[EXTRACT(ISODOW FROM d)::integer],
           EXTRACT(ISODOW FROM d) IN (6, 7),
           config_demo.data_comercial_do_dia(d),
           config_demo.janela_comercial_do_dia(d)
      FROM (SELECT g.d::date AS d
              FROM generate_series(v_ini::timestamp, v_fim::timestamp, interval '1 day') AS g(d)) dias
    ON CONFLICT (data_key) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_dim_data', v_inicio, (v_fim - v_ini + 1), v_carg, 0,
        'Linhas novas; datas já existentes são mantidas.');

    -- ---------------------------------------------------------- dim_produto
    v_inicio := clock_timestamp();
    SELECT count(*) INTO v_lidas FROM staging_demo.produto_gerado WHERE id_execucao = p_exec;
    INSERT INTO dw_demo.dim_produto
        (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao, origem_dado)
    SELECT p.codigo_produto, p.descricao, p.material, p.tipo_peca, p.tamanho, p.peso_g, p.indice_precificacao, p.origem_dado
      FROM staging_demo.produto_gerado p
     WHERE p.id_execucao = p_exec
       AND NOT staging_demo.rejeitado(p_exec, 'produto_gerado', p.codigo_produto)
     ORDER BY p.codigo_produto COLLATE "C"
    ON CONFLICT (codigo_produto) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit_demo.rejeicao
     WHERE id_execucao = p_exec AND tabela_origem = 'produto_gerado';
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_dim_produto', v_inicio, v_lidas, v_carg, v_rej,
        'Linhas novas; produtos já existentes (mesmo código) são mantidos.');

    -- ------------------------------------------------- parametro_preco_ouro
    -- Versão 1 somente para datas ainda sem preço (versões corrigidas são preservadas).
    v_inicio := clock_timestamp();
    SELECT count(*) INTO v_lidas FROM staging_demo.preco_ouro_gerado WHERE id_execucao = p_exec;
    INSERT INTO dw_demo.parametro_preco_ouro (data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente, origem_dado)
    SELECT s.data_referencia, 1, s.preco_ouro_1000, s.unidade_referencia, true, s.origem_dado
      FROM staging_demo.preco_ouro_gerado s
     WHERE s.id_execucao = p_exec
       AND NOT staging_demo.rejeitado(p_exec, 'preco_ouro_gerado', s.data_referencia::text)
       AND NOT EXISTS (SELECT 1 FROM dw_demo.parametro_preco_ouro x WHERE x.data_referencia = s.data_referencia)
     ORDER BY s.data_referencia
    ON CONFLICT (data_referencia, versao) DO NOTHING;
    GET DIAGNOSTICS v_carg = ROW_COUNT;
    SELECT count(DISTINCT chave_registro) INTO v_rej FROM audit_demo.rejeicao
     WHERE id_execucao = p_exec AND tabela_origem = 'preco_ouro_gerado';
    CALL audit_demo.registrar_etapa(p_exec, 'carregar_parametro_preco_ouro', v_inicio, v_lidas, v_carg, v_rej,
        'Linhas novas; datas com preço existente (inclusive corrigido) são mantidas.');
END;
$$;
