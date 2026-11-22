-- =============================================================================
-- 105_dw_parametro_preco_ouro.sql — preço do ouro registrado pelo cliente na
-- aplicação (app.preco_ouro), com vigência, como na fase 1.
--
-- Na aplicação cada registro é imutável e uma correção é um novo registro
-- (RN-66). O preço vigente numa data é o registro com a maior data de
-- vigência menor ou igual a ela (RN-67); vários registros com a mesma data de
-- vigência viram versões 1, 2, ... (ordem de registro) e só a última vale.
-- O preço sugerido NÃO é recalculado aqui: vem de app.preco_sugerido (RN-68),
-- a mesma função usada pela aplicação.
-- =============================================================================

CREATE TABLE IF NOT EXISTS dw.parametro_preco_ouro (
    parametro_id            bigint        NOT NULL,
    data_referencia         date          NOT NULL,
    versao                  smallint      NOT NULL,
    preco_ouro_1000         numeric(14,2) NOT NULL,
    unidade_referencia      varchar(60)   NOT NULL,
    vigente                 boolean       NOT NULL,
    substitui_parametro_id  bigint,
    motivo_correcao         text,
    criado_em               timestamptz   NOT NULL,
    id_execucao             bigint        NOT NULL,
    origem_dado             varchar(20)   NOT NULL DEFAULT 'APLICACAO',
    CONSTRAINT pk_parametro_preco_ouro PRIMARY KEY (parametro_id),
    CONSTRAINT uq_parametro_preco_ouro_versao UNIQUE (data_referencia, versao),
    CONSTRAINT fk_parametro_preco_ouro_substitui FOREIGN KEY (substitui_parametro_id)
        REFERENCES dw.parametro_preco_ouro (parametro_id),
    CONSTRAINT fk_parametro_preco_ouro_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_parametro_preco_ouro_valor CHECK (preco_ouro_1000 > 0),
    CONSTRAINT ck_parametro_preco_ouro_versao CHECK (
        (versao = 1 AND substitui_parametro_id IS NULL)
     OR (versao > 1 AND substitui_parametro_id IS NOT NULL)),
    CONSTRAINT ck_parametro_preco_ouro_origem CHECK (origem_dado = 'APLICACAO')
);
COMMENT ON TABLE dw.parametro_preco_ouro IS 'Preço do ouro registrado pelo cliente (app.preco_ouro). data_referencia = início da vigência. Versões da mesma data: só a última é vigente. A aplicação não guarda motivo de correção (motivo_correcao fica vazio).';
COMMENT ON COLUMN dw.parametro_preco_ouro.unidade_referencia IS 'R$ por grama de ouro 1000 — a confirmar com o proprietário.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_parametro_preco_ouro_vigente
    ON dw.parametro_preco_ouro (data_referencia)
    WHERE vigente;
