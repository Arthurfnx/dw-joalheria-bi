-- =============================================================================
-- 13_simular_operacao.sql — simulação diária DETERMINÍSTICA de estoque,
-- entradas (compras), vendas, presentes, roubos e ajustes. DADOS SINTÉTICOS.
--
-- Ordem em cada dia:
--   (0) no 1º dia, 00:00: SALDO_INICIAL de todos os produtos;
--   (1) chegada das reposições programadas (ENTRADA_COMPRA), às hora_abertura;
--   (2) vendas (SAIDA_VENDA), com cestas, afinidades e cenário de preço;
--   (3) presente (SAIDA_PRESENTE) e (4) roubo (SAIDA_ROUBO);
--   (5) ajustes de inventário (AJUSTE_POSITIVO/NEGATIVO) nas datas de contagem;
--   (6) programação de reposições (gatilho técnico) e reforços periódicos.
-- O saldo é mantido em memória (tabela temporária) e NUNCA fica negativo.
-- =============================================================================

-- Custo unitário SINTÉTICO (regra da simulação, não da empresa).
CREATE OR REPLACE FUNCTION staging_demo.custo_unitario_sim(
    p_sem bigint, p_chave text, p_material text, p_tipo text, p_indice numeric, p_preco_ouro numeric)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_m config_demo.material%ROWTYPE;
    v_t config_demo.tipo_peca%ROWTYPE;
BEGIN
    SELECT * INTO v_m FROM config_demo.material WHERE material = p_material;
    IF p_material = 'Folheado' THEN
        SELECT * INTO v_t FROM config_demo.tipo_peca WHERE tipo_peca = p_tipo;
        RETURN round(config_demo.rand_entre(p_sem, 'custo|' || p_chave, 0, v_t.custo_folheado_min, v_t.custo_folheado_max), 2);
    END IF;
    RETURN round(p_preco_ouro * p_indice
                 * config_demo.rand_entre(p_sem, 'custo|' || p_chave, 0, v_m.fator_custo_min, v_m.fator_custo_max), 2);
END;
$$;

-- Preço marcado SINTÉTICO.
--   Ouro/Prata: preço sugerido (regra confirmada) com variação sintética e arredondamento.
--   Folheado: custo × markup sintético (a fórmula do ouro NÃO é aplicada).
CREATE OR REPLACE FUNCTION staging_demo.preco_marcado_sim(
    p_sem bigint, p_chave text, p_material text, p_indice numeric, p_preco_ouro numeric, p_custo_unitario numeric)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_m      config_demo.material%ROWTYPE;
    v_arred  numeric := config_demo.param_decimal('arredondamento_preco_marcado');
    v_bruto  numeric;
BEGIN
    SELECT * INTO v_m FROM config_demo.material WHERE material = p_material;
    IF p_material = 'Folheado' THEN
        v_bruto := p_custo_unitario * config_demo.rand_entre(p_sem, 'markup|' || p_chave, 0, v_m.markup_min, v_m.markup_max);
    ELSE
        v_bruto := dw_demo.calcular_preco_sugerido(p_preco_ouro, p_indice)
                   * (1 + config_demo.rand_entre(p_sem, 'marcado|' || p_chave, 0, -v_m.variacao_marcado_max, v_m.variacao_marcado_max));
    END IF;
    RETURN greatest(v_arred, round(v_bruto / v_arred) * v_arred);
END;
$$;

-- Escolha ponderada de um produto com saldo, fora da cesta atual.
-- p_tipo opcional restringe o tipo de peça (afinidade). Usa as tabelas
-- temporárias da simulação (pg_temp.tmp_estado / pg_temp.tmp_cesta).
CREATE OR REPLACE FUNCTION staging_demo.escolher_produto(
    p_sem bigint, p_fluxo text, p_data date, p_corte date, p_tipo varchar)
RETURNS varchar
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_u    numeric := config_demo.rand_det(p_sem, p_fluxo, 0);
    v_cod  varchar(30);
BEGIN
    SELECT x.codigo_produto INTO v_cod
      FROM (SELECT w.codigo_produto,
                   sum(w.peso) OVER (ORDER BY w.codigo_produto COLLATE "C") AS acumulado,
                   sum(w.peso) OVER () AS total
              FROM (SELECT e.codigo_produto,
                           CASE WHEN e.perfil = 'interrompido' AND p_data >= p_corte THEN 0
                                ELSE e.peso_venda END AS peso
                      FROM pg_temp.tmp_estado e
                     WHERE e.saldo > 0
                       AND (p_tipo IS NULL OR e.tipo_peca = p_tipo)
                       AND NOT EXISTS (SELECT 1 FROM pg_temp.tmp_cesta c WHERE c.codigo_produto = e.codigo_produto)
                   ) w
             WHERE w.peso > 0
           ) x
     WHERE x.acumulado > v_u * x.total
     ORDER BY x.acumulado
     LIMIT 1;
    RETURN v_cod;
END;
$$;

-- Escolha uniforme de um produto com saldo (presentes, roubos).
CREATE OR REPLACE FUNCTION staging_demo.escolher_produto_uniforme(p_sem bigint, p_fluxo text)
RETURNS varchar
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_n    integer;
    v_cod  varchar(30);
BEGIN
    SELECT count(*) INTO v_n FROM pg_temp.tmp_estado WHERE saldo > 0;
    IF v_n = 0 THEN
        RETURN NULL;
    END IF;
    SELECT codigo_produto INTO v_cod
      FROM pg_temp.tmp_estado
     WHERE saldo > 0
     ORDER BY codigo_produto COLLATE "C"
     OFFSET config_demo.rand_int(p_sem, p_fluxo, 0, 0, v_n - 1)
     LIMIT 1;
    RETURN v_cod;
END;
$$;

-- Programa uma reposição (pedido pendente) para um produto.
CREATE OR REPLACE PROCEDURE staging_demo.programar_reposicao(
    p_sem bigint, p_chave text, p_codigo varchar, p_material varchar, p_dia date, p_prazo_min integer, p_prazo_max integer)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO pg_temp.tmp_pedido (codigo_produto, data_chegada, quantidade)
    SELECT p_codigo,
           p_dia + config_demo.rand_int(p_sem, 'prazo|' || p_chave, 0, p_prazo_min, p_prazo_max),
           config_demo.rand_int(p_sem, 'lote|' || p_chave, 0, m.lote_reposicao_min, m.lote_reposicao_max)
      FROM config_demo.material m
     WHERE m.material = p_material;
    UPDATE pg_temp.tmp_estado SET pedido_pendente = true WHERE codigo_produto = p_codigo;
END;
$$;

-- -----------------------------------------------------------------------------
-- Simulação principal.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE staging_demo.simular_operacao(p_exec bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sem          bigint  := config_demo.param_inteiro('semente');
    v_ini          date    := config_demo.param_data('data_inicio');
    v_fim          date    := config_demo.param_data('data_fim');
    v_h_abre       integer := config_demo.param_inteiro('hora_abertura');
    v_h_fecha      integer := config_demo.param_inteiro('hora_fechamento');
    v_base         numeric := config_demo.param_decimal('vendas_base_dia');
    v_p2           numeric := config_demo.param_decimal('prob_venda_2_itens');
    v_p3           numeric := config_demo.param_decimal('prob_venda_3_itens');
    v_p_afin       numeric := config_demo.param_decimal('prob_item_por_afinidade');
    v_p_qtd2       numeric := config_demo.param_decimal('prob_quantidade_2');
    v_p_igual      numeric := config_demo.param_decimal('prob_preco_igual');
    v_p_abaixo     numeric := config_demo.param_decimal('prob_preco_abaixo');
    v_desc_min     numeric := config_demo.param_decimal('desconto_min');
    v_desc_max     numeric := config_demo.param_decimal('desconto_max');
    v_acr_min      numeric := config_demo.param_decimal('acrescimo_min');
    v_acr_max      numeric := config_demo.param_decimal('acrescimo_max');
    v_gatilho      integer := config_demo.param_inteiro('reposicao_saldo_gatilho');
    v_prazo_min    integer := config_demo.param_inteiro('reposicao_prazo_min_dias');
    v_prazo_max    integer := config_demo.param_inteiro('reposicao_prazo_max_dias');
    v_ciclo        integer := config_demo.param_inteiro('reforco_ciclo_dias');
    v_p_reforco    numeric := config_demo.param_decimal('reforco_probabilidade');
    v_p_presente   numeric := config_demo.param_decimal('presente_prob_dia');
    v_roubos_ano   numeric := config_demo.param_decimal('roubos_por_ano');
    v_aj_intervalo integer := config_demo.param_inteiro('ajuste_intervalo_meses');
    v_aj_dia       integer := config_demo.param_inteiro('ajuste_dia_mes');
    v_aj_frac      numeric := config_demo.param_decimal('ajuste_fracao_produtos');
    v_int_meses    integer := config_demo.param_inteiro('interrompido_meses_finais');

    v_corte        date;
    v_dias_abertos integer;
    v_p_roubo      numeric;

    v_dia          date;
    v_idx          integer;
    v_mes_idx      integer;
    v_preco_ouro   numeric;
    v_fator_dia    numeric;
    v_aberto       boolean;

    v_ntrans       integer;
    v_t            integer;
    v_k            integer;
    v_i            integer;
    v_span         integer;
    v_hora         timestamp;

    v_seq_venda    integer := 0;
    v_seq_ent      integer := 0;
    v_seq_prs      integer := 0;
    v_seq_rou      integer := 0;
    v_seq_ajp      integer := 0;
    v_seq_ajn      integer := 0;

    v_item         integer;
    v_id_venda     text;
    v_id_evento    text;
    v_chave        text;
    v_cod          varchar(30);
    v_tipo         varchar(30);
    v_tipo_primeiro varchar(30);
    v_tipo_destino varchar(30);
    v_saldo        integer;
    v_marcado      numeric;
    v_realizado    numeric;
    v_cenario      varchar(10);
    v_qtd          integer;
    v_u            numeric;
    v_custo        numeric;
    v_marc         numeric;
    r              record;
BEGIN
    v_corte := ((v_fim + 1) - make_interval(months => v_int_meses))::date;

    SELECT count(*) INTO v_dias_abertos
      FROM generate_series(v_ini::timestamp, v_fim::timestamp, interval '1 day') AS g(d)
      JOIN config_demo.fator_dia_semana f ON f.dia_semana = EXTRACT(ISODOW FROM g.d)
     WHERE f.multiplicador > 0;
    v_p_roubo := v_roubos_ano * ((v_fim - v_ini + 1) / 365.25) / greatest(v_dias_abertos, 1);

    -- Estado da simulação (descartado no fim da transação).
    CREATE TEMP TABLE tmp_estado (
        codigo_produto  varchar(30) PRIMARY KEY,
        material        varchar(20) NOT NULL,
        tipo_peca       varchar(30) NOT NULL,
        indice          numeric(10,4) NOT NULL,
        perfil          varchar(20) NOT NULL,
        peso_venda      numeric(8,3) NOT NULL,
        saldo           integer NOT NULL,
        preco_marcado   numeric(14,2),
        pedido_pendente boolean NOT NULL DEFAULT false
    ) ON COMMIT DROP;
    CREATE TEMP TABLE tmp_pedido (
        codigo_produto  varchar(30) NOT NULL,
        data_chegada    date NOT NULL,
        quantidade      integer NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE tmp_cesta (
        codigo_produto  varchar(30) PRIMARY KEY
    ) ON COMMIT DROP;

    INSERT INTO tmp_estado (codigo_produto, material, tipo_peca, indice, perfil, peso_venda, saldo)
    SELECT p.codigo_produto, p.material, p.tipo_peca, p.indice_precificacao,
           pf.perfil_movimentacao_demo, pm.peso_venda, pf.saldo_inicial
      FROM staging_demo.produto_gerado p
      JOIN staging_demo.produto_perfil_simulacao pf
        ON pf.id_execucao = p.id_execucao AND pf.codigo_produto = p.codigo_produto
      JOIN config_demo.perfil_movimentacao pm ON pm.perfil = pf.perfil_movimentacao_demo
     WHERE p.id_execucao = p_exec;

    SELECT preco_ouro_1000 INTO v_preco_ouro
      FROM staging_demo.preco_ouro_gerado
     WHERE id_execucao = p_exec AND data_referencia = v_ini;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Simulação: série do preço do ouro ausente em % (execução %).', v_ini, p_exec;
    END IF;

    -- Preço marcado do estoque inicial.
    UPDATE tmp_estado e
       SET preco_marcado = staging_demo.preco_marcado_sim(
               v_sem, 'SIN|' || e.codigo_produto, e.material, e.indice, v_preco_ouro,
               staging_demo.custo_unitario_sim(v_sem, 'SIN|' || e.codigo_produto, e.material, e.tipo_peca, e.indice, v_preco_ouro));

    -- (0) SALDO_INICIAL.
    INSERT INTO staging_demo.movimento_gerado (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
    SELECT p_exec,
           'DEMO-SIN-' || lpad((row_number() OVER (ORDER BY e.codigo_produto COLLATE "C"))::text, 6, '0'),
           v_ini::timestamp,
           e.codigo_produto,
           'SALDO_INICIAL',
           e.saldo
      FROM tmp_estado e
     WHERE e.saldo > 0;

    v_dia := v_ini;
    WHILE v_dia <= v_fim LOOP
        v_idx := v_dia - v_ini;

        SELECT preco_ouro_1000 INTO v_preco_ouro
          FROM staging_demo.preco_ouro_gerado
         WHERE id_execucao = p_exec AND data_referencia = v_dia;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulação: série do preço do ouro ausente em %.', v_dia;
        END IF;

        SELECT multiplicador INTO v_fator_dia
          FROM config_demo.fator_dia_semana
         WHERE dia_semana = EXTRACT(ISODOW FROM v_dia);
        v_aberto := coalesce(v_fator_dia, 0) > 0;

        -- (1) Chegada de reposições.
        IF v_aberto AND EXISTS (SELECT 1 FROM tmp_pedido WHERE data_chegada <= v_dia) THEN
            v_seq_ent := v_seq_ent + 1;
            v_item := 0;
            FOR r IN
                SELECT pd.codigo_produto, pd.quantidade, e.material, e.tipo_peca, e.indice
                  FROM tmp_pedido pd
                  JOIN tmp_estado e ON e.codigo_produto = pd.codigo_produto
                 WHERE pd.data_chegada <= v_dia
                 ORDER BY pd.codigo_produto COLLATE "C"
            LOOP
                v_item := v_item + 1;
                v_chave := 'ENT|' || v_seq_ent || '|' || v_item;
                v_custo := staging_demo.custo_unitario_sim(v_sem, v_chave, r.material, r.tipo_peca, r.indice, v_preco_ouro);
                v_marc  := staging_demo.preco_marcado_sim(v_sem, v_chave, r.material, r.indice, v_preco_ouro, v_custo);
                v_id_evento := 'DEMO-ENT-' || lpad(v_seq_ent::text, 6, '0') || '-' || lpad(v_item::text, 3, '0');
                v_hora := v_dia + make_interval(hours => v_h_abre);

                INSERT INTO staging_demo.entrada_gerada
                    (id_execucao, id_evento_origem, id_entrada_sintetica, numero_item, data_hora_entrada, codigo_produto,
                     quantidade_recebida, custo_total_pago, indice_aplicado, preco_venda_marcado_unitario)
                VALUES
                    (p_exec, v_id_evento, 'DEMO-ENT-' || lpad(v_seq_ent::text, 6, '0'), v_item, v_hora, r.codigo_produto,
                     r.quantidade, round(v_custo * r.quantidade, 2), r.indice, v_marc);

                INSERT INTO staging_demo.movimento_gerado
                    (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                VALUES (p_exec, v_id_evento, v_hora, r.codigo_produto, 'ENTRADA_COMPRA', r.quantidade);

                UPDATE tmp_estado
                   SET saldo = saldo + r.quantidade, preco_marcado = v_marc, pedido_pendente = false
                 WHERE codigo_produto = r.codigo_produto;
            END LOOP;
            DELETE FROM tmp_pedido WHERE data_chegada <= v_dia;
        END IF;

        -- (2) Vendas.
        IF v_aberto THEN
            v_ntrans := config_demo.poisson_det(v_sem, 'ntrans|' || v_dia::text,
                                                v_base * v_fator_dia * config_demo.fator_sazonal(v_dia));
            v_span := (v_h_fecha - v_h_abre) * 60 - 30;
            FOR v_t IN 1 .. v_ntrans LOOP
                DELETE FROM tmp_cesta;
                v_u := config_demo.rand_det(v_sem, 'itens|' || v_dia || '|' || v_t, 0);
                v_k := CASE WHEN v_u < v_p3 THEN 3 WHEN v_u < v_p3 + v_p2 THEN 2 ELSE 1 END;
                v_hora := v_dia + make_interval(
                              hours => v_h_abre,
                              mins  => 30 + floor(((v_t - 1) + config_demo.rand_det(v_sem, 'hora|' || v_dia || '|' || v_t, 0))
                                                  / v_ntrans * v_span)::integer);
                v_item := 0;
                v_id_venda := NULL;
                v_tipo_primeiro := NULL;

                FOR v_i IN 1 .. v_k LOOP
                    v_cod := NULL;
                    v_chave := v_dia || '|' || v_t || '|' || v_i;

                    -- Item adicional por afinidade (PADRÃO SINTÉTICO INSERIDO).
                    IF v_i > 1 AND v_tipo_primeiro IS NOT NULL
                       AND config_demo.rand_det(v_sem, 'afinidade|' || v_chave, 0) < v_p_afin THEN
                        v_u := config_demo.rand_det(v_sem, 'tipo_afinidade|' || v_chave, 0);
                        SELECT x.tipo_destino INTO v_tipo_destino
                          FROM (SELECT a.tipo_destino,
                                       sum(a.peso) OVER (ORDER BY a.tipo_destino COLLATE "C") AS acumulado,
                                       sum(a.peso) OVER () AS total
                                  FROM config_demo.afinidade_tipo a
                                 WHERE a.tipo_origem = v_tipo_primeiro) x
                         WHERE x.acumulado > v_u * x.total
                         ORDER BY x.acumulado
                         LIMIT 1;
                        IF FOUND THEN
                            v_cod := staging_demo.escolher_produto(v_sem, 'produto_afinidade|' || v_chave, v_dia, v_corte, v_tipo_destino);
                        END IF;
                    END IF;

                    IF v_cod IS NULL THEN
                        v_cod := staging_demo.escolher_produto(v_sem, 'produto|' || v_chave, v_dia, v_corte, NULL);
                    END IF;
                    EXIT WHEN v_cod IS NULL;

                    IF v_id_venda IS NULL THEN
                        v_seq_venda := v_seq_venda + 1;
                        v_id_venda := 'DEMO-VND-' || lpad(v_seq_venda::text, 6, '0');
                    END IF;
                    v_item := v_item + 1;

                    SELECT saldo, preco_marcado, tipo_peca INTO v_saldo, v_marcado, v_tipo
                      FROM tmp_estado WHERE codigo_produto = v_cod;
                    IF v_tipo_primeiro IS NULL THEN
                        v_tipo_primeiro := v_tipo;
                    END IF;

                    v_qtd := CASE WHEN v_saldo >= 2 AND config_demo.rand_det(v_sem, 'quantidade|' || v_chave, 0) < v_p_qtd2
                                  THEN 2 ELSE 1 END;

                    -- Cenário de preço realizado (PADRÃO SINTÉTICO; pode ser abaixo, igual ou acima).
                    v_u := config_demo.rand_det(v_sem, 'cenario|' || v_chave, 0);
                    IF v_u < v_p_igual THEN
                        v_cenario := 'IGUAL';
                        v_realizado := v_marcado;
                    ELSIF v_u < v_p_igual + v_p_abaixo THEN
                        v_cenario := 'ABAIXO';
                        v_realizado := round(v_marcado * (1 - config_demo.rand_entre(v_sem, 'desconto|' || v_chave, 0, v_desc_min, v_desc_max)), 2);
                    ELSE
                        v_cenario := 'ACIMA';
                        v_realizado := round(v_marcado * (1 + config_demo.rand_entre(v_sem, 'acrescimo|' || v_chave, 0, v_acr_min, v_acr_max)), 2);
                    END IF;
                    IF v_realizado <= 0 THEN
                        v_realizado := 0.01;
                    END IF;

                    v_id_evento := v_id_venda || '-' || lpad(v_item::text, 2, '0');

                    INSERT INTO staging_demo.venda_gerada
                        (id_execucao, id_evento_origem, id_venda_sintetica, numero_item, data_hora_venda, codigo_produto,
                         quantidade_vendida, preco_venda_marcado_unitario, preco_vendido_realizado_unitario, cenario_preco)
                    VALUES
                        (p_exec, v_id_evento, v_id_venda, v_item, v_hora, v_cod,
                         v_qtd, v_marcado, v_realizado, v_cenario);

                    INSERT INTO staging_demo.movimento_gerado
                        (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                    VALUES (p_exec, v_id_evento, v_hora, v_cod, 'SAIDA_VENDA', v_qtd);

                    UPDATE tmp_estado SET saldo = saldo - v_qtd WHERE codigo_produto = v_cod;
                    INSERT INTO tmp_cesta (codigo_produto) VALUES (v_cod);
                END LOOP;
            END LOOP;
        END IF;

        -- (3) Presente (saída sem faturamento).
        IF v_aberto AND config_demo.rand_det(v_sem, 'presente|' || v_dia, 0) < v_p_presente THEN
            v_cod := staging_demo.escolher_produto_uniforme(v_sem, 'presente_produto|' || v_dia);
            IF v_cod IS NOT NULL THEN
                v_seq_prs := v_seq_prs + 1;
                INSERT INTO staging_demo.movimento_gerado
                    (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                VALUES (p_exec, 'DEMO-PRS-' || lpad(v_seq_prs::text, 6, '0'),
                        v_dia + make_interval(hours => v_h_fecha - 1), v_cod, 'SAIDA_PRESENTE', 1);
                UPDATE tmp_estado SET saldo = saldo - 1 WHERE codigo_produto = v_cod;
            END IF;
        END IF;

        -- (4) Roubo (saída sem faturamento).
        IF v_aberto AND config_demo.rand_det(v_sem, 'roubo|' || v_dia, 0) < v_p_roubo THEN
            v_cod := staging_demo.escolher_produto_uniforme(v_sem, 'roubo_produto|' || v_dia);
            IF v_cod IS NOT NULL THEN
                v_seq_rou := v_seq_rou + 1;
                INSERT INTO staging_demo.movimento_gerado
                    (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                VALUES (p_exec, 'DEMO-ROU-' || lpad(v_seq_rou::text, 6, '0'),
                        v_dia + make_interval(hours => (v_h_abre + v_h_fecha) / 2), v_cod, 'SAIDA_ROUBO', 1);
                UPDATE tmp_estado SET saldo = saldo - 1 WHERE codigo_produto = v_cod;
            END IF;
        END IF;

        -- (5) Ajustes de inventário (contagem periódica).
        v_mes_idx := (EXTRACT(YEAR FROM v_dia)::integer * 12 + EXTRACT(MONTH FROM v_dia)::integer)
                   - (EXTRACT(YEAR FROM v_ini)::integer * 12 + EXTRACT(MONTH FROM v_ini)::integer);
        IF EXTRACT(DAY FROM v_dia)::integer = v_aj_dia AND (v_mes_idx + 1) % v_aj_intervalo = 0 THEN
            FOR r IN SELECT e.codigo_produto, e.saldo FROM tmp_estado e ORDER BY e.codigo_produto COLLATE "C" LOOP
                IF config_demo.rand_det(v_sem, 'ajuste|' || v_dia || '|' || r.codigo_produto, 0) < v_aj_frac THEN
                    IF r.saldo >= 1 AND config_demo.rand_det(v_sem, 'ajuste_direcao|' || v_dia || '|' || r.codigo_produto, 0) < 0.5 THEN
                        v_seq_ajn := v_seq_ajn + 1;
                        INSERT INTO staging_demo.movimento_gerado
                            (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                        VALUES (p_exec, 'DEMO-AJN-' || lpad(v_seq_ajn::text, 6, '0'),
                                v_dia + make_interval(hours => v_h_fecha), r.codigo_produto, 'AJUSTE_NEGATIVO', 1);
                        UPDATE tmp_estado SET saldo = saldo - 1 WHERE codigo_produto = r.codigo_produto;
                    ELSE
                        v_seq_ajp := v_seq_ajp + 1;
                        INSERT INTO staging_demo.movimento_gerado
                            (id_execucao, id_evento_origem, data_hora_evento, codigo_produto, codigo_tipo, quantidade)
                        VALUES (p_exec, 'DEMO-AJP-' || lpad(v_seq_ajp::text, 6, '0'),
                                v_dia + make_interval(hours => v_h_fecha), r.codigo_produto, 'AJUSTE_POSITIVO', 1);
                        UPDATE tmp_estado SET saldo = saldo + 1 WHERE codigo_produto = r.codigo_produto;
                    END IF;
                END IF;
            END LOOP;
        END IF;

        -- (6a) Reposição por gatilho TÉCNICO da simulação (não é estoque mínimo real).
        FOR r IN
            SELECT e.codigo_produto, e.material
              FROM tmp_estado e
             WHERE e.saldo <= v_gatilho
               AND NOT e.pedido_pendente
               AND NOT (e.perfil = 'interrompido' AND v_dia >= v_corte)
             ORDER BY e.codigo_produto COLLATE "C"
        LOOP
            CALL staging_demo.programar_reposicao(v_sem, 'gatilho|' || v_dia || '|' || r.codigo_produto,
                                                  r.codigo_produto, r.material, v_dia, v_prazo_min, v_prazo_max);
        END LOOP;

        -- (6b) Reforço periódico para produtos de giro alto/médio.
        IF v_idx > 0 AND v_idx % v_ciclo = 0 THEN
            FOR r IN
                SELECT e.codigo_produto, e.material
                  FROM tmp_estado e
                 WHERE e.perfil IN ('alta', 'media') AND NOT e.pedido_pendente
                 ORDER BY e.codigo_produto COLLATE "C"
            LOOP
                IF config_demo.rand_det(v_sem, 'reforco|' || v_dia || '|' || r.codigo_produto, 0) < v_p_reforco THEN
                    CALL staging_demo.programar_reposicao(v_sem, 'reforco|' || v_dia || '|' || r.codigo_produto,
                                                          r.codigo_produto, r.material, v_dia, v_prazo_min, v_prazo_max);
                END IF;
            END LOOP;
        END IF;

        v_dia := v_dia + 1;
    END LOOP;

    -- Saldo final mantido pelo gerador (para reconciliação SNP-03).
    INSERT INTO staging_demo.saldo_final_gerador (id_execucao, codigo_produto, saldo_final)
    SELECT p_exec, e.codigo_produto, e.saldo FROM tmp_estado e;

    IF EXISTS (SELECT 1 FROM tmp_estado WHERE saldo < 0) THEN
        RAISE EXCEPTION 'Simulação: saldo negativo detectado (defeito do gerador).';
    END IF;
END;
$$;
