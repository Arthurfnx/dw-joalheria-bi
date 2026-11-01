-- =============================================================================
-- 02_funcoes_config.sql — leitura tipada de parâmetros, validação e hash da
-- configuração, e funções de calendário comercial.
-- =============================================================================

CREATE OR REPLACE FUNCTION config_demo.param_texto(p_chave text)
RETURNS text
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_valor text;
BEGIN
    SELECT valor INTO v_valor FROM config_demo.parametro WHERE chave = p_chave;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parâmetro de configuração inexistente: %', p_chave;
    END IF;
    RETURN v_valor;
END;
$$;

CREATE OR REPLACE FUNCTION config_demo.param_inteiro(p_chave text)
RETURNS bigint LANGUAGE sql STABLE
AS $$ SELECT config_demo.param_texto(p_chave)::bigint $$;

CREATE OR REPLACE FUNCTION config_demo.param_decimal(p_chave text)
RETURNS numeric LANGUAGE sql STABLE
AS $$ SELECT config_demo.param_texto(p_chave)::numeric $$;

CREATE OR REPLACE FUNCTION config_demo.param_data(p_chave text)
RETURNS date LANGUAGE sql STABLE
AS $$ SELECT config_demo.param_texto(p_chave)::date $$;

-- -----------------------------------------------------------------------------
-- Datas comerciais (calendário). Regras de calendário, não dados da empresa.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION config_demo.data_comercial_no_ano(p_nome text, p_ano integer)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE p_nome
        -- primeiro domingo de maio + 7 dias
        WHEN 'Dia das Mães' THEN
            make_date(p_ano, 5, 1) + ((7 - EXTRACT(ISODOW FROM make_date(p_ano, 5, 1))::integer) % 7) + 7
        WHEN 'Dia dos Namorados' THEN
            make_date(p_ano, 6, 12)
        -- primeira quinta-feira de novembro + 21 dias (quarta quinta) + 1 dia
        WHEN 'Black Friday' THEN
            make_date(p_ano, 11, 1) + ((4 - EXTRACT(ISODOW FROM make_date(p_ano, 11, 1))::integer + 7) % 7) + 22
        WHEN 'Natal' THEN
            make_date(p_ano, 12, 25)
    END
$$;

-- Nome da data comercial que cai exatamente no dia (ou NULL).
CREATE OR REPLACE FUNCTION config_demo.data_comercial_do_dia(p_data date)
RETURNS varchar
LANGUAGE sql STABLE
AS $$
    SELECT dc.data_comercial
      FROM config_demo.data_comercial dc
     WHERE config_demo.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM p_data)::integer) = p_data
     ORDER BY dc.multiplicador DESC, dc.data_comercial COLLATE "C"
     LIMIT 1
$$;

-- Data comercial cuja janela [data - dias_janela, data] contém o dia (ou NULL).
CREATE OR REPLACE FUNCTION config_demo.janela_comercial_do_dia(p_data date)
RETURNS varchar
LANGUAGE sql STABLE
AS $$
    SELECT dc.data_comercial
      FROM config_demo.data_comercial dc
     WHERE p_data BETWEEN config_demo.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM p_data)::integer) - dc.dias_janela
                      AND config_demo.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM p_data)::integer)
     ORDER BY dc.multiplicador DESC, dc.data_comercial COLLATE "C"
     LIMIT 1
$$;

-- Multiplicador sazonal SINTÉTICO do dia (1 fora de janelas).
CREATE OR REPLACE FUNCTION config_demo.fator_sazonal(p_data date)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(max(dc.multiplicador), 1.0)
      FROM config_demo.data_comercial dc
     WHERE p_data BETWEEN config_demo.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM p_data)::integer) - dc.dias_janela
                      AND config_demo.data_comercial_no_ano(dc.data_comercial, EXTRACT(YEAR FROM p_data)::integer)
$$;

-- -----------------------------------------------------------------------------
-- Validação da configuração (lança exceção na primeira inconsistência).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION config_demo.validar_configuracao()
RETURNS void
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_ini date := config_demo.param_data('data_inicio');
    v_fim date := config_demo.param_data('data_fim');
    v_soma numeric;
    v_material text;
BEGIN
    IF v_fim < v_ini THEN
        RAISE EXCEPTION 'Configuração inválida: data_fim (%) anterior a data_inicio (%).', v_fim, v_ini;
    END IF;
    IF config_demo.param_inteiro('hora_fechamento') <= config_demo.param_inteiro('hora_abertura') + 1
       OR config_demo.param_inteiro('hora_abertura') < 0 OR config_demo.param_inteiro('hora_fechamento') > 23 THEN
        RAISE EXCEPTION 'Configuração inválida: horário de funcionamento (abertura < fechamento - 1, entre 0 e 23).';
    END IF;
    IF config_demo.param_decimal('prob_venda_2_itens') + config_demo.param_decimal('prob_venda_3_itens') > 1
       OR config_demo.param_decimal('prob_preco_igual') + config_demo.param_decimal('prob_preco_abaixo') > 1 THEN
        RAISE EXCEPTION 'Configuração inválida: probabilidades complementares somam mais que 1.';
    END IF;
    IF config_demo.param_decimal('desconto_min') < 0 OR config_demo.param_decimal('desconto_max') >= 1
       OR config_demo.param_decimal('desconto_max') < config_demo.param_decimal('desconto_min')
       OR config_demo.param_decimal('acrescimo_min') < 0
       OR config_demo.param_decimal('acrescimo_max') < config_demo.param_decimal('acrescimo_min') THEN
        RAISE EXCEPTION 'Configuração inválida: faixas de desconto/acréscimo.';
    END IF;
    IF config_demo.param_decimal('preco_ouro_base') <= 0
       OR config_demo.param_decimal('preco_ouro_variacao_diaria_max') NOT BETWEEN 0 AND 0.2 THEN
        RAISE EXCEPTION 'Configuração inválida: série do preço do ouro.';
    END IF;
    IF config_demo.param_inteiro('reposicao_prazo_max_dias') < config_demo.param_inteiro('reposicao_prazo_min_dias')
       OR config_demo.param_inteiro('reposicao_prazo_min_dias') < 1
       OR config_demo.param_inteiro('reforco_ciclo_dias') < 1
       OR config_demo.param_inteiro('ajuste_intervalo_meses') < 1
       OR config_demo.param_inteiro('ajuste_dia_mes') NOT BETWEEN 1 AND 28 THEN
        RAISE EXCEPTION 'Configuração inválida: prazos/ciclos (ajuste_dia_mes deve estar entre 1 e 28).';
    END IF;
    IF config_demo.param_texto('frequencia_snapshot') <> 'MENSAL' THEN
        RAISE EXCEPTION 'Configuração inválida: frequencia_snapshot implementada somente como MENSAL.';
    END IF;
    IF config_demo.param_decimal('arredondamento_preco_marcado') <= 0 THEN
        RAISE EXCEPTION 'Configuração inválida: arredondamento_preco_marcado deve ser positivo.';
    END IF;

    SELECT sum(proporcao) INTO v_soma FROM config_demo.perfil_movimentacao;
    IF v_soma IS NULL OR abs(v_soma - 1) > 0.0001 THEN
        RAISE EXCEPTION 'Configuração inválida: proporções de perfil somam % (esperado 1).', v_soma;
    END IF;

    FOR v_material IN SELECT material FROM config_demo.material WHERE qtd_produtos > 0 LOOP
        IF coalesce((SELECT sum(peso) FROM config_demo.distribuicao_tipo WHERE material = v_material), 0) <= 0 THEN
            RAISE EXCEPTION 'Configuração inválida: material % sem distribuição de tipos de peça.', v_material;
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM config_demo.fator_dia_semana) <> 7
       OR NOT EXISTS (SELECT 1 FROM config_demo.fator_dia_semana WHERE multiplicador > 0) THEN
        RAISE EXCEPTION 'Configuração inválida: fator_dia_semana deve ter os 7 dias e ao menos um dia de funcionamento.';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Hash da configuração (somente colunas que afetam a geração).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION config_demo.hash_configuracao()
RETURNS char(32)
LANGUAGE sql STABLE
AS $$
    SELECT md5(concat_ws('#',
        (SELECT string_agg(chave || '=' || valor, ';' ORDER BY chave COLLATE "C") FROM config_demo.parametro),
        (SELECT string_agg(concat_ws(',', material, prefixo_codigo, qtd_produtos, saldo_inicial_min, saldo_inicial_max,
                                     lote_reposicao_min, lote_reposicao_max, indice_min, indice_max, fator_custo_min,
                                     fator_custo_max, markup_min, markup_max, variacao_marcado_max), ';' ORDER BY material COLLATE "C")
           FROM config_demo.material),
        (SELECT string_agg(concat_ws(',', tipo_peca, exige_tamanho, tamanho_min, tamanho_max, peso_ouro_min_g,
                                     peso_ouro_max_g, custo_folheado_min, custo_folheado_max), ';' ORDER BY tipo_peca COLLATE "C")
           FROM config_demo.tipo_peca),
        (SELECT string_agg(concat_ws(',', material, tipo_peca, peso), ';' ORDER BY material COLLATE "C", tipo_peca COLLATE "C")
           FROM config_demo.distribuicao_tipo),
        (SELECT string_agg(concat_ws(',', perfil, ordem, proporcao, peso_venda), ';' ORDER BY ordem)
           FROM config_demo.perfil_movimentacao),
        (SELECT string_agg(concat_ws(',', dia_semana, multiplicador), ';' ORDER BY dia_semana)
           FROM config_demo.fator_dia_semana),
        (SELECT string_agg(concat_ws(',', data_comercial, dias_janela, multiplicador), ';' ORDER BY data_comercial COLLATE "C")
           FROM config_demo.data_comercial),
        (SELECT string_agg(concat_ws(',', tipo_origem, tipo_destino, peso), ';' ORDER BY tipo_origem COLLATE "C", tipo_destino COLLATE "C")
           FROM config_demo.afinidade_tipo)
    ))::char(32)
$$;
COMMENT ON FUNCTION config_demo.hash_configuracao() IS 'md5 das colunas de configuração que influenciam a geração (descrições não entram).';
