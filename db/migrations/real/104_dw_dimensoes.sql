-- =============================================================================
-- 104_dw_dimensoes.sql — dimensões conformadas do DW real.
-- Mesma estrutura dimensional da fase 1, sem a marcação SINTETICO_DEMO:
-- origem_dado indica de onde veio o registro no banco operacional
--   APLICACAO  registrado na aplicação
--   PLANILHA   importado das planilhas (cadastro, saldo inicial, histórico)
--   CALENDARIO linha de calendário gerada pelo próprio DW (somente dim_data)
-- Nenhuma coluna para nome de pessoa.
-- =============================================================================

-- Chave de data AAAAMMDD.
CREATE OR REPLACE FUNCTION dw.data_key(p_data date)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT (EXTRACT(YEAR FROM p_data) * 10000
          + EXTRACT(MONTH FROM p_data) * 100
          + EXTRACT(DAY FROM p_data))::integer
$$;
COMMENT ON FUNCTION dw.data_key(date) IS 'Converte uma data na chave inteira AAAAMMDD de dim_data.';

-- -----------------------------------------------------------------------------
-- Datas comerciais: convenção de ANÁLISE herdada da fase 1 (regras de
-- calendário e tamanho das janelas). Não é dado nem regra da empresa e não
-- carrega nenhum efeito esperado sobre as vendas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.data_comercial (
    data_comercial    varchar(30)  NOT NULL,
    regra_calendario  text         NOT NULL,
    dias_janela       smallint     NOT NULL,
    CONSTRAINT pk_data_comercial PRIMARY KEY (data_comercial),
    CONSTRAINT ck_data_comercial_janela CHECK (dias_janela BETWEEN 0 AND 60)
);
COMMENT ON TABLE dw.data_comercial IS 'Convenção de análise (fase 1): janela [data - dias_janela, data] de cada data comercial. Não é informação da empresa.';

INSERT INTO dw.data_comercial (data_comercial, regra_calendario, dias_janela) VALUES
    ('Dia das Mães',      'Segundo domingo de maio',                                7),
    ('Dia dos Namorados', '12 de junho',                                             5),
    ('Black Friday',      'Sexta-feira seguinte à quarta quinta-feira de novembro',  3),
    ('Natal',             '25 de dezembro',                                         24)
ON CONFLICT (data_comercial) DO NOTHING;

CREATE OR REPLACE FUNCTION dw.data_comercial_no_ano(p_nome text, p_ano integer)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE p_nome
        WHEN 'Dia das Mães' THEN
            make_date(p_ano, 5, 1) + ((7 - EXTRACT(ISODOW FROM make_date(p_ano, 5, 1))::integer) % 7) + 7
        WHEN 'Dia dos Namorados' THEN
            make_date(p_ano, 6, 12)
        WHEN 'Black Friday' THEN
            make_date(p_ano, 11, 1) + ((4 - EXTRACT(ISODOW FROM make_date(p_ano, 11, 1))::integer + 7) % 7) + 22
        WHEN 'Natal' THEN
            make_date(p_ano, 12, 25)
    END
$$;

-- -----------------------------------------------------------------------------
-- dim_data — calendário (um dia por linha).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.dim_data (
    data_key          integer      NOT NULL,
    data              date         NOT NULL,
    dia               smallint     NOT NULL,
    mes               smallint     NOT NULL,
    nome_mes          varchar(12)  NOT NULL,
    trimestre         smallint     NOT NULL,
    ano               smallint     NOT NULL,
    ano_mes           char(7)      NOT NULL,
    dia_semana        smallint     NOT NULL,
    nome_dia_semana   varchar(15)  NOT NULL,
    fim_de_semana     boolean      NOT NULL,
    data_comercial    varchar(30),
    janela_comercial  varchar(30),
    origem_dado       varchar(20)  NOT NULL DEFAULT 'CALENDARIO',
    CONSTRAINT pk_dim_data PRIMARY KEY (data_key),
    CONSTRAINT uq_dim_data_data UNIQUE (data),
    CONSTRAINT ck_dim_data_key CHECK (data_key = dw.data_key(data)),
    CONSTRAINT ck_dim_data_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_dim_data_origem CHECK (origem_dado = 'CALENDARIO')
);
COMMENT ON TABLE dw.dim_data IS 'Calendário (grão: um dia), da data mais antiga dos fatos até a data de referência da carga. dia_semana ISO: 1 = segunda.';

-- -----------------------------------------------------------------------------
-- dim_tipo_movimentacao — tipos do banco operacional, com os mesmos códigos.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.dim_tipo_movimentacao (
    tipo_mov_key      smallint     NOT NULL,
    codigo_tipo       varchar(30)  NOT NULL,
    descricao_tipo    varchar(100) NOT NULL,
    natureza          varchar(20)  NOT NULL,
    sinal             smallint     NOT NULL,
    eh_venda          boolean      NOT NULL,
    gera_faturamento  boolean      NOT NULL,
    origem_dado       varchar(20)  NOT NULL DEFAULT 'APLICACAO',
    CONSTRAINT pk_dim_tipo_movimentacao PRIMARY KEY (tipo_mov_key),
    CONSTRAINT uq_dim_tipo_mov_codigo UNIQUE (codigo_tipo),
    CONSTRAINT ck_dim_tipo_mov_sinal CHECK (sinal IN (-1, 1)),
    CONSTRAINT ck_dim_tipo_mov_natureza CHECK (natureza IN ('implantação', 'entrada', 'saída', 'ajuste', 'estorno')),
    CONSTRAINT ck_dim_tipo_mov_venda CHECK (gera_faturamento = eh_venda),
    CONSTRAINT ck_dim_tipo_mov_origem CHECK (origem_dado = 'APLICACAO')
);
COMMENT ON TABLE dw.dim_tipo_movimentacao IS 'Tipos de movimentação de app.tipo_movimentacao (mesmos códigos). Saldo = Σ(quantidade × sinal). Somente SAIDA_VENDA é venda; o faturamento vem de fato_venda_item.';

-- -----------------------------------------------------------------------------
-- dim_produto — catálogo (SCD tipo 1: recarga completa a cada execução).
-- produto_key = id do produto no banco operacional (estável entre cargas).
-- local_estoque nunca traz o nome da pessoa: peça consignada = 'Consignado'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.dim_produto (
    produto_key           bigint        NOT NULL,
    codigo_produto        text          NOT NULL,
    descricao             text          NOT NULL,
    material              text          NOT NULL,
    tipo_peca             text          NOT NULL,
    subcategoria          text,
    tamanho               text,
    peso_g                numeric(10,3),
    indice_precificacao   numeric(14,4),
    modo_controle         varchar(12)   NOT NULL,
    local_estoque         varchar(20),
    ativo                 boolean       NOT NULL,
    preco_venda           numeric(14,2),
    preco_sugerido_atual  numeric(14,2),
    valor_aquisicao       numeric(14,2),
    data_aquisicao        date,
    id_execucao           bigint        NOT NULL,
    origem_dado           varchar(20)   NOT NULL,
    CONSTRAINT pk_dim_produto PRIMARY KEY (produto_key),
    CONSTRAINT uq_dim_produto_codigo UNIQUE (codigo_produto),
    CONSTRAINT fk_dim_produto_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_dim_produto_modo CHECK (modo_controle IN ('UNITARIO', 'QUANTIDADE')),
    CONSTRAINT ck_dim_produto_local CHECK (local_estoque IS NULL OR local_estoque IN ('Estoque', 'Armário', 'Maleta 1', 'Maleta 2', 'Consignado')),
    CONSTRAINT ck_dim_produto_peso CHECK (peso_g IS NULL OR peso_g > 0),
    CONSTRAINT ck_dim_produto_indice CHECK (indice_precificacao IS NULL OR indice_precificacao > 0),
    CONSTRAINT ck_dim_produto_valores CHECK (coalesce(preco_venda, 0) >= 0 AND coalesce(preco_sugerido_atual, 0) >= 0 AND coalesce(valor_aquisicao, 0) >= 0),
    CONSTRAINT ck_dim_produto_origem CHECK (origem_dado IN ('APLICACAO', 'PLANILHA'))
);
COMMENT ON TABLE dw.dim_produto IS 'Catálogo do banco operacional. tipo_peca = categoria da aplicação. local_estoque: Consignado sem o nome da pessoa. preco_sugerido_atual = app.preco_sugerido(produto, data de referência) (RN-68).';

-- -----------------------------------------------------------------------------
-- controle_carga — linha única com as referências da última carga.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.controle_carga (
    id                   smallint      NOT NULL DEFAULT 1,
    id_execucao          bigint        NOT NULL,
    extraido_em          timestamptz   NOT NULL,
    data_referencia      date          NOT NULL,
    data_inicio_estoque  date          NOT NULL,
    fator_preco_ouro     numeric(10,4),
    atualizado_em        timestamptz   NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_controle_carga PRIMARY KEY (id),
    CONSTRAINT ck_controle_carga_unica CHECK (id = 1),
    CONSTRAINT fk_controle_carga_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao)
);
COMMENT ON TABLE dw.controle_carga IS 'Linha única: execução, instante da extração, data de referência (último snapshot), início dos snapshots (data da importação) e fator do preço do ouro.';
