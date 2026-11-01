-- =============================================================================
-- 005_dw_demo_dimensoes.sql — dimensões conformadas do DW demonstrativo.
-- =============================================================================

-- Chave de data AAAAMMDD (imutável, usada em CHECKs e cargas).
CREATE OR REPLACE FUNCTION dw_demo.data_key(p_data date)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT (EXTRACT(YEAR FROM p_data) * 10000
          + EXTRACT(MONTH FROM p_data) * 100
          + EXTRACT(DAY FROM p_data))::integer
$$;
COMMENT ON FUNCTION dw_demo.data_key(date) IS 'Converte uma data na chave inteira AAAAMMDD de dim_data.';

-- -----------------------------------------------------------------------------
-- dim_data — calendário (datas reais do calendário; marcação do ambiente demo).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.dim_data (
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
    origem_dado       varchar(20)  NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_dim_data PRIMARY KEY (data_key),
    CONSTRAINT uq_dim_data_data UNIQUE (data),
    CONSTRAINT ck_dim_data_key CHECK (data_key = dw_demo.data_key(data)),
    CONSTRAINT ck_dim_data_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_dim_data_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.dim_data IS 'Dimensão calendário (grão: um dia). dia_semana ISO: 1 = segunda. data_comercial/janela_comercial conforme config_demo.data_comercial.';

-- -----------------------------------------------------------------------------
-- dim_tipo_movimentacao — domínio fixo; controla o SINAL da movimentação.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.dim_tipo_movimentacao (
    tipo_mov_key      smallint     NOT NULL,
    codigo_tipo       varchar(30)  NOT NULL,
    descricao_tipo    varchar(100) NOT NULL,
    natureza          varchar(20)  NOT NULL,
    sinal             smallint     NOT NULL,
    eh_venda          boolean      NOT NULL,
    gera_faturamento  boolean      NOT NULL,
    origem_dado       varchar(20)  NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_dim_tipo_movimentacao PRIMARY KEY (tipo_mov_key),
    CONSTRAINT uq_dim_tipo_mov_codigo UNIQUE (codigo_tipo),
    CONSTRAINT ck_dim_tipo_mov_sinal CHECK (sinal IN (-1, 1)),
    CONSTRAINT ck_dim_tipo_mov_natureza CHECK (natureza IN ('implantação', 'entrada', 'saída', 'ajuste')),
    CONSTRAINT ck_dim_tipo_mov_venda CHECK (gera_faturamento = eh_venda),
    CONSTRAINT ck_dim_tipo_mov_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.dim_tipo_movimentacao IS 'Tipos de movimentação. Saldo = Σ(quantidade × sinal). Somente SAIDA_VENDA é venda; o faturamento vem de fato_venda_item.';

INSERT INTO dw_demo.dim_tipo_movimentacao
    (tipo_mov_key, codigo_tipo, descricao_tipo, natureza, sinal, eh_venda, gera_faturamento)
VALUES
    (1, 'SALDO_INICIAL',   'Implantação do saldo inicial',   'implantação',  1, false, false),
    (2, 'ENTRADA_COMPRA',  'Entrada por compra',             'entrada',      1, false, false),
    (3, 'SAIDA_VENDA',     'Saída por venda',                'saída',       -1, true,  true),
    (4, 'SAIDA_PRESENTE',  'Saída por presente',             'saída',       -1, false, false),
    (5, 'SAIDA_ROUBO',     'Saída por roubo',                'saída',       -1, false, false),
    (6, 'AJUSTE_POSITIVO', 'Ajuste positivo de inventário',  'ajuste',       1, false, false),
    (7, 'AJUSTE_NEGATIVO', 'Ajuste negativo de inventário',  'ajuste',      -1, false, false)
ON CONFLICT (tipo_mov_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- dim_produto — catálogo sintético (SCD tipo 1 nesta fase).
-- Material e tipo de peça são atributos distintos. Sem restrição tipo × material.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.dim_produto (
    produto_key          bigint GENERATED ALWAYS AS IDENTITY,
    codigo_produto       varchar(30)   NOT NULL,
    descricao            varchar(200)  NOT NULL,
    material             varchar(20)   NOT NULL,
    tipo_peca            varchar(30)   NOT NULL,
    tamanho              varchar(10),
    peso_g               numeric(8,3),
    indice_precificacao  numeric(10,4) NOT NULL,
    origem_dado          varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_dim_produto PRIMARY KEY (produto_key),
    CONSTRAINT uq_dim_produto_codigo UNIQUE (codigo_produto),
    CONSTRAINT ck_dim_produto_codigo CHECK (codigo_produto ~ '^DEMO-(OURO|PRATA|FOLHADO)-[0-9]{4}$'),
    CONSTRAINT ck_dim_produto_material CHECK (material IN ('Ouro', 'Prata', 'Folheado')),
    CONSTRAINT ck_dim_produto_prefixo CHECK (
        (material = 'Ouro'     AND codigo_produto LIKE 'DEMO-OURO-%')
     OR (material = 'Prata'    AND codigo_produto LIKE 'DEMO-PRATA-%')
     OR (material = 'Folheado' AND codigo_produto LIKE 'DEMO-FOLHADO-%')),
    CONSTRAINT ck_dim_produto_peso_positivo CHECK (peso_g IS NULL OR peso_g > 0),
    CONSTRAINT ck_dim_produto_ouro_peso CHECK (material <> 'Ouro' OR peso_g IS NOT NULL),
    CONSTRAINT ck_dim_produto_folheado_sem_peso CHECK (material <> 'Folheado' OR peso_g IS NULL),
    CONSTRAINT ck_dim_produto_anel_tamanho CHECK (tipo_peca <> 'Anel' OR tamanho IS NOT NULL),
    CONSTRAINT ck_dim_produto_ouro_tamanho CHECK (material <> 'Ouro' OR tipo_peca = 'Anel' OR tamanho IS NULL),
    CONSTRAINT ck_dim_produto_indice CHECK (indice_precificacao > 0),
    CONSTRAINT ck_dim_produto_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.dim_produto IS 'Catálogo SINTÉTICO. Ouro: peso obrigatório, tamanho só em anel. Prata: peso não exigido. Folheado: sem peso. Anel: tamanho obrigatório.';
COMMENT ON COLUMN dw_demo.dim_produto.indice_precificacao IS 'Índice de precificação atual. Fórmula do preço sugerido aplicada somente a Ouro e Prata.';

-- -----------------------------------------------------------------------------
-- controle_carga — configuração (hash/semente) que originou os dados do DW.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.controle_carga (
    id                 smallint     NOT NULL DEFAULT 1,
    hash_configuracao  char(32)     NOT NULL,
    semente            bigint       NOT NULL,
    primeira_execucao  bigint       NOT NULL,
    ultima_execucao    bigint       NOT NULL,
    atualizado_em      timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_controle_carga PRIMARY KEY (id),
    CONSTRAINT ck_controle_carga_unica CHECK (id = 1)
);
COMMENT ON TABLE dw_demo.controle_carga IS 'Linha única: hash da configuração dos dados carregados. Configuração diferente exige reset controlado.';
