-- =============================================================================
-- 002_audit_demo.sql — auditoria técnica exclusiva do ambiente demonstrativo.
-- O histórico desta schema é preservado pelo reset da demo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_demo.execucao (
    id_execucao        bigint GENERATED ALWAYS AS IDENTITY,
    ambiente           varchar(10)  NOT NULL DEFAULT 'DEMO',
    iniciado_em        timestamptz  NOT NULL DEFAULT clock_timestamp(),
    finalizado_em      timestamptz,
    status             varchar(12)  NOT NULL DEFAULT 'EM_EXECUCAO',
    semente            bigint,
    hash_configuracao  char(32),
    usuario_banco      text         NOT NULL DEFAULT current_user,
    mensagem           text,
    CONSTRAINT pk_execucao PRIMARY KEY (id_execucao),
    CONSTRAINT ck_execucao_ambiente CHECK (ambiente = 'DEMO'),
    CONSTRAINT ck_execucao_status CHECK (status IN ('EM_EXECUCAO', 'SUCESSO', 'FALHA'))
);
COMMENT ON TABLE audit_demo.execucao IS 'Uma linha por execução do ETL demonstrativo.';

CREATE TABLE IF NOT EXISTS audit_demo.etapa (
    id_etapa           bigint GENERATED ALWAYS AS IDENTITY,
    id_execucao        bigint       NOT NULL,
    etapa              varchar(60)  NOT NULL,
    iniciado_em        timestamptz  NOT NULL,
    finalizado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    linhas_lidas       bigint,
    linhas_carregadas  bigint,
    linhas_rejeitadas  bigint,
    observacao         text,
    CONSTRAINT pk_etapa PRIMARY KEY (id_etapa),
    CONSTRAINT fk_etapa_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao)
);
COMMENT ON TABLE audit_demo.etapa IS 'Contagens por etapa (lidas, carregadas, rejeitadas).';

CREATE TABLE IF NOT EXISTS audit_demo.rejeicao (
    id_rejeicao        bigint GENERATED ALWAYS AS IDENTITY,
    id_execucao        bigint       NOT NULL,
    tabela_origem      varchar(60)  NOT NULL,
    chave_registro     varchar(100) NOT NULL,
    regra              varchar(60)  NOT NULL,
    valor_observado    text,
    registrado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_rejeicao PRIMARY KEY (id_rejeicao),
    CONSTRAINT fk_rejeicao_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT uq_rejeicao UNIQUE (id_execucao, tabela_origem, chave_registro, regra)
);
COMMENT ON TABLE audit_demo.rejeicao IS 'Registros de staging rejeitados e motivo. Nada é descartado silenciosamente.';

CREATE TABLE IF NOT EXISTS audit_demo.resultado_validacao (
    id_resultado       bigint GENERATED ALWAYS AS IDENTITY,
    id_execucao        bigint       NOT NULL,
    codigo             varchar(10)  NOT NULL,
    grupo              varchar(20)  NOT NULL,
    descricao          text         NOT NULL,
    esperado           text,
    obtido             text,
    aprovado           boolean      NOT NULL,
    verificado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_resultado_validacao PRIMARY KEY (id_resultado),
    CONSTRAINT fk_resultado_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT uq_resultado_validacao UNIQUE (id_execucao, codigo)
);
COMMENT ON TABLE audit_demo.resultado_validacao IS 'Resultado das verificações de qualidade (docs/data_quality.md).';

CREATE TABLE IF NOT EXISTS audit_demo.correcao_preco_ouro (
    id_correcao            bigint GENERATED ALWAYS AS IDENTITY,
    data_referencia        date          NOT NULL,
    parametro_id_anterior  bigint        NOT NULL,
    parametro_id_novo      bigint        NOT NULL,
    valor_anterior         numeric(12,2) NOT NULL,
    valor_novo             numeric(12,2) NOT NULL,
    motivo                 text          NOT NULL,
    usuario_banco          text          NOT NULL DEFAULT current_user,
    corrigido_em           timestamptz   NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_correcao_preco_ouro PRIMARY KEY (id_correcao)
);
COMMENT ON TABLE audit_demo.correcao_preco_ouro IS 'Histórico de correções do preço do ouro (versionamento).';

CREATE TABLE IF NOT EXISTS audit_demo.reset_registro (
    id_reset           bigint GENERATED ALWAYS AS IDENTITY,
    executado_em       timestamptz NOT NULL DEFAULT clock_timestamp(),
    usuario_banco      text        NOT NULL DEFAULT current_user,
    observacao         text,
    CONSTRAINT pk_reset_registro PRIMARY KEY (id_reset)
);
COMMENT ON TABLE audit_demo.reset_registro IS 'Registro de cada reset controlado do ambiente demonstrativo.';

CREATE TABLE IF NOT EXISTS audit_demo.migracao_aplicada (
    arquivo            varchar(200) NOT NULL,
    sha256             char(64)     NOT NULL,
    aplicado_em        timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_migracao_aplicada PRIMARY KEY (arquivo)
);
COMMENT ON TABLE audit_demo.migracao_aplicada IS 'Arquivos SQL aplicados por scripts/run_migrations.ps1 e seu hash.';
