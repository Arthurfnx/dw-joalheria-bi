-- =============================================================================
-- 006_dw_demo_parametro_preco_ouro.sql
-- Preço do ouro versionado + regra confirmada de preço sugerido.
-- =============================================================================

-- REGRA DE NEGÓCIO CONFIRMADA (Ouro e Prata somente):
-- PREÇO SUGERIDO = PREÇO DO OURO 1000 NA DATA × 1,6 × ÍNDICE.
-- Para Folheado esta função NÃO deve ser aplicada.
CREATE OR REPLACE FUNCTION dw_demo.calcular_preco_sugerido(p_preco_ouro_1000 numeric, p_indice numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT round(p_preco_ouro_1000 * 1.6 * p_indice, 2)
$$;
COMMENT ON FUNCTION dw_demo.calcular_preco_sugerido(numeric, numeric) IS 'Regra confirmada: preço do ouro 1000 × 1,6 × índice, arredondado a centavos. Somente Ouro e Prata.';

CREATE TABLE IF NOT EXISTS dw_demo.parametro_preco_ouro (
    parametro_id            bigint GENERATED ALWAYS AS IDENTITY,
    data_referencia         date          NOT NULL,
    versao                  smallint      NOT NULL DEFAULT 1,
    preco_ouro_1000         numeric(12,2) NOT NULL,
    unidade_referencia      varchar(40)   NOT NULL,
    vigente                 boolean       NOT NULL DEFAULT true,
    substitui_parametro_id  bigint,
    motivo_correcao         text,
    criado_em               timestamptz   NOT NULL DEFAULT clock_timestamp(),
    origem_dado             varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_parametro_preco_ouro PRIMARY KEY (parametro_id),
    CONSTRAINT uq_parametro_preco_ouro_versao UNIQUE (data_referencia, versao),
    CONSTRAINT fk_parametro_preco_ouro_substitui FOREIGN KEY (substitui_parametro_id)
        REFERENCES dw_demo.parametro_preco_ouro (parametro_id),
    CONSTRAINT ck_parametro_preco_ouro_valor CHECK (preco_ouro_1000 > 0),
    CONSTRAINT ck_parametro_preco_ouro_versao CHECK (
        (versao = 1 AND substitui_parametro_id IS NULL AND motivo_correcao IS NULL)
     OR (versao > 1 AND substitui_parametro_id IS NOT NULL AND length(btrim(motivo_correcao)) > 0)),
    CONSTRAINT ck_parametro_preco_ouro_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.parametro_preco_ouro IS 'Preço do ouro 1000 por data, VERSIONADO. Correções criam nova versão (dw_demo.corrigir_preco_ouro). No demo, unidade_referencia = NAO_CONFIRMADA_DEMO: não é cotação oficial.';
COMMENT ON COLUMN dw_demo.parametro_preco_ouro.unidade_referencia IS 'Unidade do preço. Na demo: NAO_CONFIRMADA_DEMO. A unidade real precisa ser explicitada e validada na fase 2.';

-- No máximo uma versão vigente por data.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parametro_preco_ouro_vigente
    ON dw_demo.parametro_preco_ouro (data_referencia)
    WHERE vigente;

-- -----------------------------------------------------------------------------
-- Proteção: sem DELETE; sem alteração de valores; desativação só via procedure.
-- (TRUNCATE não dispara este gatilho: é usado apenas pelo reset controlado.)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dw_demo.tg_parametro_preco_ouro_protecao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'parametro_preco_ouro: exclusão não permitida (parametro_id=%). Use dw_demo.corrigir_preco_ouro para criar nova versão.', OLD.parametro_id;
    END IF;

    IF NEW.parametro_id           IS DISTINCT FROM OLD.parametro_id
       OR NEW.data_referencia     IS DISTINCT FROM OLD.data_referencia
       OR NEW.versao              IS DISTINCT FROM OLD.versao
       OR NEW.preco_ouro_1000     IS DISTINCT FROM OLD.preco_ouro_1000
       OR NEW.unidade_referencia  IS DISTINCT FROM OLD.unidade_referencia
       OR NEW.substitui_parametro_id IS DISTINCT FROM OLD.substitui_parametro_id
       OR NEW.motivo_correcao     IS DISTINCT FROM OLD.motivo_correcao
       OR NEW.criado_em           IS DISTINCT FROM OLD.criado_em
       OR NEW.origem_dado         IS DISTINCT FROM OLD.origem_dado THEN
        RAISE EXCEPTION 'parametro_preco_ouro: valores de uma versão não podem ser alterados (parametro_id=%). Use dw_demo.corrigir_preco_ouro.', OLD.parametro_id;
    END IF;

    IF NOT OLD.vigente AND NEW.vigente THEN
        RAISE EXCEPTION 'parametro_preco_ouro: uma versão substituída não pode voltar a ser vigente (parametro_id=%).', OLD.parametro_id;
    END IF;

    IF OLD.vigente AND NOT NEW.vigente
       AND coalesce(current_setting('dw_demo.correcao_autorizada', true), '') <> 'on' THEN
        RAISE EXCEPTION 'parametro_preco_ouro: desativação permitida somente por dw_demo.corrigir_preco_ouro.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tg_parametro_preco_ouro_protecao
    BEFORE UPDATE OR DELETE ON dw_demo.parametro_preco_ouro
    FOR EACH ROW EXECUTE FUNCTION dw_demo.tg_parametro_preco_ouro_protecao();

-- -----------------------------------------------------------------------------
-- Registro de um preço para uma data ainda sem preço (versão 1).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE dw_demo.registrar_preco_ouro(
    p_data date,
    p_valor numeric,
    p_unidade varchar DEFAULT 'NAO_CONFIRMADA_DEMO')
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_data IS NULL OR p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'registrar_preco_ouro: data e valor positivo são obrigatórios.';
    END IF;
    IF EXISTS (SELECT 1 FROM dw_demo.parametro_preco_ouro WHERE data_referencia = p_data) THEN
        RAISE EXCEPTION 'registrar_preco_ouro: já existe preço para %. Para alterar, use dw_demo.corrigir_preco_ouro (nova versão com motivo).', p_data;
    END IF;
    INSERT INTO dw_demo.parametro_preco_ouro (data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente)
    VALUES (p_data, 1, p_valor, p_unidade, true);
END;
$$;

-- -----------------------------------------------------------------------------
-- Correção versionada: cria versão N+1 vigente e desativa a anterior.
-- Entradas já registradas mantêm parametro_id e o valor copiado (sem retroatividade).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE dw_demo.corrigir_preco_ouro(
    p_data date,
    p_novo_valor numeric,
    p_motivo text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_antigo  dw_demo.parametro_preco_ouro%ROWTYPE;
    v_novo_id bigint;
BEGIN
    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
        RAISE EXCEPTION 'corrigir_preco_ouro: o motivo da correção é obrigatório.';
    END IF;
    IF p_novo_valor IS NULL OR p_novo_valor <= 0 THEN
        RAISE EXCEPTION 'corrigir_preco_ouro: o novo valor deve ser positivo.';
    END IF;

    SELECT * INTO v_antigo
      FROM dw_demo.parametro_preco_ouro
     WHERE data_referencia = p_data AND vigente
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'corrigir_preco_ouro: não há preço vigente para %.', p_data;
    END IF;
    IF v_antigo.preco_ouro_1000 = p_novo_valor THEN
        RAISE EXCEPTION 'corrigir_preco_ouro: o novo valor é igual ao vigente.';
    END IF;

    PERFORM set_config('dw_demo.correcao_autorizada', 'on', true);
    UPDATE dw_demo.parametro_preco_ouro SET vigente = false WHERE parametro_id = v_antigo.parametro_id;
    PERFORM set_config('dw_demo.correcao_autorizada', 'off', true);

    INSERT INTO dw_demo.parametro_preco_ouro
        (data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente,
         substitui_parametro_id, motivo_correcao, origem_dado)
    VALUES
        (p_data, v_antigo.versao + 1, p_novo_valor, v_antigo.unidade_referencia, true,
         v_antigo.parametro_id, p_motivo, v_antigo.origem_dado)
    RETURNING parametro_id INTO v_novo_id;

    INSERT INTO audit_demo.correcao_preco_ouro
        (data_referencia, parametro_id_anterior, parametro_id_novo, valor_anterior, valor_novo, motivo)
    VALUES
        (p_data, v_antigo.parametro_id, v_novo_id, v_antigo.preco_ouro_1000, p_novo_valor, p_motivo);
END;
$$;
