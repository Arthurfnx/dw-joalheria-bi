-- =============================================================================
-- 004_staging_demo.sql — recepção dos registros sintéticos gerados.
-- Sem CHECKs de negócio de propósito: a validação (etl/sql/demo/20_*) registra
-- as violações em audit_demo.rejeicao. Cada execução tem suas próprias linhas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging_demo.produto_gerado (
    id_execucao          bigint        NOT NULL,
    codigo_produto       varchar(30)   NOT NULL,
    descricao            varchar(200),
    material             varchar(20),
    tipo_peca            varchar(30),
    tamanho              varchar(10),
    peso_g               numeric(8,3),
    indice_precificacao  numeric(10,4),
    origem_dado          varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_stg_produto PRIMARY KEY (id_execucao, codigo_produto),
    CONSTRAINT fk_stg_produto_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);

-- Atributos TÉCNICOS do gerador (não vão para dim_produto nem para o BI).
CREATE TABLE IF NOT EXISTS staging_demo.produto_perfil_simulacao (
    id_execucao          bigint        NOT NULL,
    codigo_produto       varchar(30)   NOT NULL,
    perfil_movimentacao_demo varchar(20) NOT NULL,
    saldo_inicial        integer       NOT NULL,
    CONSTRAINT pk_stg_perfil PRIMARY KEY (id_execucao, codigo_produto),
    CONSTRAINT fk_stg_perfil_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);
COMMENT ON TABLE staging_demo.produto_perfil_simulacao IS 'Atributo técnico do gerador (perfil de movimentação). Não exposto em dw_demo.dim_produto nem em bi_demo.';

CREATE TABLE IF NOT EXISTS staging_demo.preco_ouro_gerado (
    id_execucao          bigint        NOT NULL,
    data_referencia      date          NOT NULL,
    preco_ouro_1000      numeric(12,2),
    unidade_referencia   varchar(40),
    origem_dado          varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_stg_preco_ouro PRIMARY KEY (id_execucao, data_referencia),
    CONSTRAINT fk_stg_preco_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);

CREATE TABLE IF NOT EXISTS staging_demo.entrada_gerada (
    id_execucao                   bigint        NOT NULL,
    id_evento_origem              varchar(30)   NOT NULL,
    id_entrada_sintetica          varchar(20)   NOT NULL,
    numero_item                   smallint      NOT NULL,
    data_hora_entrada             timestamp     NOT NULL,
    codigo_produto                varchar(30)   NOT NULL,
    quantidade_recebida           integer,
    custo_total_pago              numeric(14,2),
    indice_aplicado               numeric(10,4),
    preco_venda_marcado_unitario  numeric(14,2),
    origem_dado                   varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_stg_entrada PRIMARY KEY (id_execucao, id_evento_origem),
    CONSTRAINT fk_stg_entrada_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);

CREATE TABLE IF NOT EXISTS staging_demo.venda_gerada (
    id_execucao                       bigint        NOT NULL,
    id_evento_origem                  varchar(30)   NOT NULL,
    id_venda_sintetica                varchar(20)   NOT NULL,
    numero_item                       smallint      NOT NULL,
    data_hora_venda                   timestamp     NOT NULL,
    codigo_produto                    varchar(30)   NOT NULL,
    quantidade_vendida                integer,
    preco_venda_marcado_unitario      numeric(14,2),
    preco_vendido_realizado_unitario  numeric(14,2),
    cenario_preco                     varchar(10),
    origem_dado                       varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_stg_venda PRIMARY KEY (id_execucao, id_evento_origem),
    CONSTRAINT fk_stg_venda_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);
COMMENT ON COLUMN staging_demo.venda_gerada.cenario_preco IS 'Técnico: IGUAL, ABAIXO ou ACIMA do preço marcado (cenário sintético).';

CREATE TABLE IF NOT EXISTS staging_demo.movimento_gerado (
    id_execucao          bigint        NOT NULL,
    id_evento_origem     varchar(30)   NOT NULL,
    data_hora_evento     timestamp     NOT NULL,
    codigo_produto       varchar(30)   NOT NULL,
    codigo_tipo          varchar(30)   NOT NULL,
    quantidade           integer,
    origem_dado          varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_stg_movimento PRIMARY KEY (id_execucao, id_evento_origem),
    CONSTRAINT fk_stg_movimento_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);

CREATE TABLE IF NOT EXISTS staging_demo.saldo_final_gerador (
    id_execucao          bigint        NOT NULL,
    codigo_produto       varchar(30)   NOT NULL,
    saldo_final          integer       NOT NULL,
    CONSTRAINT pk_stg_saldo_final PRIMARY KEY (id_execucao, codigo_produto),
    CONSTRAINT fk_stg_saldo_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);
COMMENT ON TABLE staging_demo.saldo_final_gerador IS 'Saldo final mantido pelo gerador, usado para reconciliar o último snapshot (SNP-03).';
