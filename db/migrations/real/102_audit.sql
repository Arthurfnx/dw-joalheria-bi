-- =============================================================================
-- 102_audit.sql — auditoria do DW real. Só recebe inserções (e o fechamento
-- da própria execução); o ETL nunca apaga linhas daqui.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit.migracao_aplicada (
    arquivo            varchar(200) NOT NULL,
    sha256             char(64)     NOT NULL,
    aplicado_em        timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_migracao_aplicada PRIMARY KEY (arquivo)
);
COMMENT ON TABLE audit.migracao_aplicada IS 'Arquivos SQL do DW real aplicados por scripts/run_migrations_real.ps1 e seu hash.';

CREATE TABLE IF NOT EXISTS audit.execucao (
    id_execucao        bigint GENERATED ALWAYS AS IDENTITY,
    iniciado_em        timestamptz  NOT NULL DEFAULT clock_timestamp(),
    finalizado_em      timestamptz,
    status             varchar(12)  NOT NULL DEFAULT 'EM_EXECUCAO',
    banco_origem       text,
    usuario_origem     text,
    usuario_banco      text         NOT NULL DEFAULT current_user,
    mensagem           text,
    CONSTRAINT pk_execucao PRIMARY KEY (id_execucao),
    CONSTRAINT ck_execucao_status CHECK (status IN ('EM_EXECUCAO', 'SUCESSO', 'FALHA'))
);
COMMENT ON TABLE audit.execucao IS 'Uma linha por execução do ETL real (scripts/run_etl_app.ps1).';

CREATE TABLE IF NOT EXISTS audit.etapa (
    id_etapa           bigint GENERATED ALWAYS AS IDENTITY,
    id_execucao        bigint       NOT NULL,
    etapa              varchar(60)  NOT NULL,
    tabela             varchar(60),
    iniciado_em        timestamptz  NOT NULL,
    finalizado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    linhas_lidas       bigint,
    linhas_carregadas  bigint,
    linhas_rejeitadas  bigint,
    observacao         text,
    CONSTRAINT pk_etapa PRIMARY KEY (id_etapa),
    CONSTRAINT fk_etapa_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao)
);
COMMENT ON TABLE audit.etapa IS 'Contagens por etapa e por tabela: lidas, carregadas e rejeitadas.';

CREATE TABLE IF NOT EXISTS audit.rejeicao (
    id_rejeicao        bigint GENERATED ALWAYS AS IDENTITY,
    id_execucao        bigint       NOT NULL,
    tabela_origem      varchar(60)  NOT NULL,
    chave_registro     varchar(100) NOT NULL,
    regra              varchar(60)  NOT NULL,
    valor_observado    text,
    registrado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_rejeicao PRIMARY KEY (id_rejeicao),
    CONSTRAINT fk_rejeicao_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT uq_rejeicao UNIQUE (id_execucao, tabela_origem, chave_registro, regra)
);
COMMENT ON TABLE audit.rejeicao IS 'Registros de staging rejeitados e o motivo. Chave = id técnico do banco operacional; nunca guarda descrição nem nome de pessoa.';

CREATE TABLE IF NOT EXISTS audit.resultado_validacao (
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
    CONSTRAINT fk_resultado_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT uq_resultado_validacao UNIQUE (id_execucao, codigo)
);
COMMENT ON TABLE audit.resultado_validacao IS 'Verificações de qualidade do ETL real. A execução falha se alguma for reprovada.';

-- audit só recebe inserções: UPDATE só para fechar a própria execução; DELETE nunca.
CREATE OR REPLACE FUNCTION audit.tg_somente_insercao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit.%: exclusão não permitida (o histórico de auditoria só recebe inserções).', TG_TABLE_NAME;
    END IF;
    -- IFs aninhados: OLD.status só existe em audit.execucao.
    IF TG_TABLE_NAME = 'execucao' THEN
        IF OLD.status = 'EM_EXECUCAO' AND OLD.id_execucao = NEW.id_execucao
           AND OLD.iniciado_em = NEW.iniciado_em THEN
            RETURN NEW;   -- fechamento da execução (status, fim, mensagem)
        END IF;
    ELSIF TG_TABLE_NAME = 'migracao_aplicada' THEN
        RETURN NEW;       -- reaplicação de um arquivo atualiza o hash registrado
    END IF;
    RAISE EXCEPTION 'audit.%: alteração não permitida (o histórico de auditoria só recebe inserções).', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE TRIGGER tg_execucao_somente_insercao
    BEFORE UPDATE OR DELETE ON audit.execucao
    FOR EACH ROW EXECUTE FUNCTION audit.tg_somente_insercao();
CREATE OR REPLACE TRIGGER tg_etapa_somente_insercao
    BEFORE UPDATE OR DELETE ON audit.etapa
    FOR EACH ROW EXECUTE FUNCTION audit.tg_somente_insercao();
CREATE OR REPLACE TRIGGER tg_rejeicao_somente_insercao
    BEFORE UPDATE OR DELETE ON audit.rejeicao
    FOR EACH ROW EXECUTE FUNCTION audit.tg_somente_insercao();
CREATE OR REPLACE TRIGGER tg_resultado_somente_insercao
    BEFORE UPDATE OR DELETE ON audit.resultado_validacao
    FOR EACH ROW EXECUTE FUNCTION audit.tg_somente_insercao();
CREATE OR REPLACE TRIGGER tg_migracao_somente_insercao
    BEFORE UPDATE OR DELETE ON audit.migracao_aplicada
    FOR EACH ROW EXECUTE FUNCTION audit.tg_somente_insercao();
