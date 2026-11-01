-- =============================================================================
-- 003_config_demo.sql — tabelas de configuração da simulação (DEMO).
-- Os VALORES padrão são inseridos por etl/sql/demo/00_config_padrao.sql.
-- Todos os valores são sugestões configuráveis, NÃO fatos sobre a empresa.
-- =============================================================================

-- Parâmetros escalares (chave/valor tipado).
CREATE TABLE IF NOT EXISTS config_demo.parametro (
    chave        varchar(60)  NOT NULL,
    valor        text         NOT NULL,
    tipo         varchar(10)  NOT NULL,
    natureza     varchar(20)  NOT NULL,
    descricao    text         NOT NULL,
    CONSTRAINT pk_cfg_parametro PRIMARY KEY (chave),
    CONSTRAINT ck_cfg_parametro_tipo CHECK (tipo IN ('inteiro', 'decimal', 'data', 'texto')),
    CONSTRAINT ck_cfg_parametro_natureza CHECK (natureza IN ('REGRA_SIMULACAO', 'PADRAO_SINTETICO', 'CONTROLE'))
);
COMMENT ON TABLE config_demo.parametro IS 'Parâmetros escalares da simulação. natureza: REGRA_SIMULACAO (mecanismo técnico), PADRAO_SINTETICO (padrão inserido para demonstrar visuais) ou CONTROLE.';

-- Parâmetros por material (família comercial).
CREATE TABLE IF NOT EXISTS config_demo.material (
    material               varchar(20)  NOT NULL,
    prefixo_codigo         varchar(10)  NOT NULL,
    qtd_produtos           integer      NOT NULL,
    saldo_inicial_min      integer      NOT NULL,
    saldo_inicial_max      integer      NOT NULL,
    lote_reposicao_min     integer      NOT NULL,
    lote_reposicao_max     integer      NOT NULL,
    indice_min             numeric(10,4) NOT NULL,
    indice_max             numeric(10,4) NOT NULL,
    fator_custo_min        numeric(6,4),
    fator_custo_max        numeric(6,4),
    markup_min             numeric(6,4),
    markup_max             numeric(6,4),
    variacao_marcado_max   numeric(6,4) NOT NULL DEFAULT 0,
    CONSTRAINT pk_cfg_material PRIMARY KEY (material),
    CONSTRAINT uq_cfg_material_prefixo UNIQUE (prefixo_codigo),
    CONSTRAINT ck_cfg_material_dominio CHECK (material IN ('Ouro', 'Prata', 'Folheado')),
    CONSTRAINT ck_cfg_material_prefixo CHECK (prefixo_codigo ~ '^[A-Z]+$'),
    CONSTRAINT ck_cfg_material_qtd CHECK (qtd_produtos BETWEEN 0 AND 9999),
    CONSTRAINT ck_cfg_material_saldo CHECK (saldo_inicial_min >= 1 AND saldo_inicial_max >= saldo_inicial_min),
    CONSTRAINT ck_cfg_material_lote CHECK (lote_reposicao_min >= 1 AND lote_reposicao_max >= lote_reposicao_min),
    CONSTRAINT ck_cfg_material_indice CHECK (indice_min > 0 AND indice_max >= indice_min),
    CONSTRAINT ck_cfg_material_variacao CHECK (variacao_marcado_max BETWEEN 0 AND 0.5),
    CONSTRAINT ck_cfg_material_precificacao CHECK (
        (material = 'Folheado' AND markup_min > 0 AND markup_max >= markup_min)
        OR (material <> 'Folheado' AND fator_custo_min > 0 AND fator_custo_max >= fator_custo_min)
    )
);
COMMENT ON TABLE config_demo.material IS 'Parâmetros da simulação por material. Para Ouro, indice_min/max são índice POR GRAMA (índice = peso_g × fator). Para Prata e Folheado, são o próprio índice.';
COMMENT ON COLUMN config_demo.material.fator_custo_min IS 'Ouro/Prata: custo unitário sintético = preço do ouro × índice × fator_custo.';
COMMENT ON COLUMN config_demo.material.markup_min IS 'Folheado: preço marcado sintético = custo unitário × markup.';
COMMENT ON COLUMN config_demo.material.variacao_marcado_max IS 'Ouro/Prata: variação sintética (±) do preço marcado em torno do preço sugerido.';

-- Parâmetros por tipo de peça (independente do material).
CREATE TABLE IF NOT EXISTS config_demo.tipo_peca (
    tipo_peca              varchar(30)  NOT NULL,
    exige_tamanho          boolean      NOT NULL DEFAULT false,
    tamanho_min            smallint,
    tamanho_max            smallint,
    peso_ouro_min_g        numeric(8,3) NOT NULL,
    peso_ouro_max_g        numeric(8,3) NOT NULL,
    custo_folheado_min     numeric(14,2) NOT NULL,
    custo_folheado_max     numeric(14,2) NOT NULL,
    CONSTRAINT pk_cfg_tipo_peca PRIMARY KEY (tipo_peca),
    CONSTRAINT ck_cfg_tipo_tamanho CHECK (NOT exige_tamanho OR (tamanho_min IS NOT NULL AND tamanho_max >= tamanho_min)),
    CONSTRAINT ck_cfg_tipo_peso CHECK (peso_ouro_min_g > 0 AND peso_ouro_max_g >= peso_ouro_min_g),
    CONSTRAINT ck_cfg_tipo_custo CHECK (custo_folheado_min > 0 AND custo_folheado_max >= custo_folheado_min)
);
COMMENT ON TABLE config_demo.tipo_peca IS 'Tipos de peça. exige_tamanho = true somente para Anel nesta demo. Peso só é gerado para Ouro.';

-- Distribuição de tipos de peça por material (todas as combinações permitidas).
CREATE TABLE IF NOT EXISTS config_demo.distribuicao_tipo (
    material      varchar(20)  NOT NULL,
    tipo_peca     varchar(30)  NOT NULL,
    peso          numeric(8,3) NOT NULL,
    CONSTRAINT pk_cfg_distribuicao_tipo PRIMARY KEY (material, tipo_peca),
    CONSTRAINT fk_cfg_dist_material FOREIGN KEY (material) REFERENCES config_demo.material (material),
    CONSTRAINT fk_cfg_dist_tipo FOREIGN KEY (tipo_peca) REFERENCES config_demo.tipo_peca (tipo_peca),
    CONSTRAINT ck_cfg_dist_peso CHECK (peso >= 0)
);
COMMENT ON TABLE config_demo.distribuicao_tipo IS 'Pesos relativos de cada tipo de peça dentro de cada material. Não há restrição de tipo por material.';

-- Perfis técnicos de movimentação (atributo do gerador, não do produto).
CREATE TABLE IF NOT EXISTS config_demo.perfil_movimentacao (
    perfil        varchar(20)  NOT NULL,
    ordem         smallint     NOT NULL,
    proporcao     numeric(5,4) NOT NULL,
    peso_venda    numeric(8,3) NOT NULL,
    descricao     text         NOT NULL,
    CONSTRAINT pk_cfg_perfil PRIMARY KEY (perfil),
    CONSTRAINT uq_cfg_perfil_ordem UNIQUE (ordem),
    CONSTRAINT ck_cfg_perfil_dominio CHECK (perfil IN ('alta', 'media', 'baixa', 'parado', 'interrompido')),
    CONSTRAINT ck_cfg_perfil_proporcao CHECK (proporcao BETWEEN 0 AND 1),
    CONSTRAINT ck_cfg_perfil_peso CHECK (peso_venda >= 0)
);
COMMENT ON TABLE config_demo.perfil_movimentacao IS 'REGRA DA SIMULAÇÃO: perfis de giro sintético. Não aparecem em dim_produto nem nos relatórios.';

-- Multiplicador por dia da semana (0 = loja fechada na simulação).
CREATE TABLE IF NOT EXISTS config_demo.fator_dia_semana (
    dia_semana    smallint     NOT NULL,
    nome          varchar(15)  NOT NULL,
    multiplicador numeric(6,3) NOT NULL,
    CONSTRAINT pk_cfg_fator_dia PRIMARY KEY (dia_semana),
    CONSTRAINT ck_cfg_fator_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_cfg_fator_mult CHECK (multiplicador >= 0)
);
COMMENT ON TABLE config_demo.fator_dia_semana IS 'REGRA DA SIMULAÇÃO: dia_semana ISO (1 = segunda). multiplicador 0 = sem funcionamento.';

-- Datas comerciais e fatores sazonais (PADRÃO SINTÉTICO INSERIDO).
CREATE TABLE IF NOT EXISTS config_demo.data_comercial (
    data_comercial   varchar(30)  NOT NULL,
    regra_calendario text         NOT NULL,
    dias_janela      smallint     NOT NULL,
    multiplicador    numeric(6,3) NOT NULL,
    CONSTRAINT pk_cfg_data_comercial PRIMARY KEY (data_comercial),
    CONSTRAINT ck_cfg_data_comercial_nome CHECK (data_comercial IN ('Dia das Mães', 'Dia dos Namorados', 'Black Friday', 'Natal')),
    CONSTRAINT ck_cfg_data_comercial_janela CHECK (dias_janela BETWEEN 0 AND 60),
    CONSTRAINT ck_cfg_data_comercial_mult CHECK (multiplicador >= 0)
);
COMMENT ON TABLE config_demo.data_comercial IS 'PADRÃO SINTÉTICO INSERIDO: multiplicadores de vendas nas janelas [data - dias_janela, data]. Não são conclusões sobre a empresa.';

-- Afinidades entre tipos de peça (PADRÃO SINTÉTICO INSERIDO).
CREATE TABLE IF NOT EXISTS config_demo.afinidade_tipo (
    tipo_origem   varchar(30)  NOT NULL,
    tipo_destino  varchar(30)  NOT NULL,
    peso          numeric(8,3) NOT NULL,
    CONSTRAINT pk_cfg_afinidade PRIMARY KEY (tipo_origem, tipo_destino),
    CONSTRAINT fk_cfg_afin_origem FOREIGN KEY (tipo_origem) REFERENCES config_demo.tipo_peca (tipo_peca),
    CONSTRAINT fk_cfg_afin_destino FOREIGN KEY (tipo_destino) REFERENCES config_demo.tipo_peca (tipo_peca),
    CONSTRAINT ck_cfg_afin_peso CHECK (peso > 0)
);
COMMENT ON TABLE config_demo.afinidade_tipo IS 'PADRÃO SINTÉTICO INSERIDO: ao adicionar itens a uma venda, o gerador pode escolher o tipo destino com estes pesos.';
