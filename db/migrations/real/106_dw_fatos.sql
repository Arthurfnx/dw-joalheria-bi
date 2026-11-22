-- =============================================================================
-- 106_dw_fatos.sql — tabelas fato do DW real.
-- Quantidades em PEÇAS; valores em R$. Os fatos não se relacionam entre si no
-- modelo semântico; id_evento_origem serve à rastreabilidade em SQL e aponta
-- para o registro do banco operacional (tabela + id técnico).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fato_venda_item — GRÃO: um produto vendido.
--   APLICACAO: um item de venda CONFIRMADA da aplicação; id_venda = número da
--              venda emitido pela aplicação (identificador real de transação).
--   PLANILHA : um registro de app.venda_historica; sem identificador de venda
--              (id_venda vazio) e sem preço marcado.
-- Faturamento (valor_faturado) exclui o valor simbólico (R$ 0,01 da planilha)
-- e as vendas sem valor informado. Vendas canceladas não entram.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.fato_venda_item (
    venda_item_key                    bigint GENERATED ALWAYS AS IDENTITY,
    id_venda                          bigint,
    numero_item                       smallint      NOT NULL,
    id_evento_origem                  varchar(40)   NOT NULL,
    data_key                          integer       NOT NULL,
    data_hora_venda                   timestamp     NOT NULL,
    produto_key                       bigint        NOT NULL,
    quantidade_vendida                integer       NOT NULL,
    preco_venda_marcado_unitario      numeric(14,2),
    preco_vendido_realizado_unitario  numeric(14,2),
    valor_simbolico                   boolean       NOT NULL DEFAULT false,
    entra_faturamento                 boolean       GENERATED ALWAYS AS (
        preco_vendido_realizado_unitario IS NOT NULL AND NOT valor_simbolico) STORED,
    valor_realizado_total             numeric(14,2) GENERATED ALWAYS AS (
        quantidade_vendida * preco_vendido_realizado_unitario) STORED,
    valor_faturado                    numeric(14,2) GENERATED ALWAYS AS (
        CASE WHEN preco_vendido_realizado_unitario IS NOT NULL AND NOT valor_simbolico
             THEN quantidade_vendida * preco_vendido_realizado_unitario END) STORED,
    valor_marcado_total               numeric(14,2) GENERATED ALWAYS AS (
        CASE WHEN preco_vendido_realizado_unitario IS NOT NULL AND NOT valor_simbolico
              AND preco_venda_marcado_unitario IS NOT NULL
             THEN quantidade_vendida * preco_venda_marcado_unitario END) STORED,
    diferenca_marcado_realizado       numeric(14,2) GENERATED ALWAYS AS (
        CASE WHEN preco_vendido_realizado_unitario IS NOT NULL AND NOT valor_simbolico
              AND preco_venda_marcado_unitario IS NOT NULL
             THEN quantidade_vendida * (preco_venda_marcado_unitario - preco_vendido_realizado_unitario) END) STORED,
    id_execucao                       bigint        NOT NULL,
    origem_dado                       varchar(20)   NOT NULL,
    CONSTRAINT pk_fato_venda_item PRIMARY KEY (venda_item_key),
    CONSTRAINT uq_fato_venda_evento UNIQUE (id_evento_origem),
    CONSTRAINT uq_fato_venda_venda_item UNIQUE (id_venda, numero_item),
    CONSTRAINT fk_fato_venda_data FOREIGN KEY (data_key) REFERENCES dw.dim_data (data_key),
    CONSTRAINT fk_fato_venda_produto FOREIGN KEY (produto_key) REFERENCES dw.dim_produto (produto_key),
    CONSTRAINT fk_fato_venda_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_fato_venda_data_key CHECK (data_key = dw.data_key(data_hora_venda::date)),
    CONSTRAINT ck_fato_venda_quantidade CHECK (quantidade_vendida > 0),
    CONSTRAINT ck_fato_venda_marcado CHECK (preco_venda_marcado_unitario IS NULL OR preco_venda_marcado_unitario >= 0),
    CONSTRAINT ck_fato_venda_realizado CHECK (preco_vendido_realizado_unitario IS NULL OR preco_vendido_realizado_unitario >= 0),
    CONSTRAINT ck_fato_venda_origem CHECK (origem_dado IN ('APLICACAO', 'PLANILHA')),
    CONSTRAINT ck_fato_venda_identificador CHECK ((origem_dado = 'APLICACAO') = (id_venda IS NOT NULL)),
    CONSTRAINT ck_fato_venda_aplicacao CHECK (
        origem_dado = 'PLANILHA' OR (preco_vendido_realizado_unitario IS NOT NULL AND NOT valor_simbolico)),
    CONSTRAINT ck_fato_venda_planilha CHECK (
        origem_dado = 'APLICACAO' OR (preco_venda_marcado_unitario IS NULL AND quantidade_vendida = 1))
);
COMMENT ON TABLE dw.fato_venda_item IS 'GRÃO: um produto vendido. APLICACAO = item de venda confirmada (id_venda = número emitido pela aplicação). PLANILHA = venda histórica importada, sem identificador de venda nem preço marcado. Faturamento = valor_faturado (exclui valor simbólico e vendas sem valor).';
COMMENT ON COLUMN dw.fato_venda_item.id_venda IS 'Número da venda emitido pela aplicação. Vazio nas vendas da planilha, que não têm identificador de transação: ticket médio e associação usam só as vendas com id_venda (RN-73).';
COMMENT ON COLUMN dw.fato_venda_item.valor_simbolico IS 'Venda histórica com valor de R$ 0,01 (marcação da importação, RN-99). Não entra no faturamento.';
COMMENT ON COLUMN dw.fato_venda_item.diferenca_marcado_realizado IS 'Positiva = desconto; negativa = venda acima do preço marcado. Só quando o preço marcado é conhecido e a venda entra no faturamento.';

CREATE INDEX IF NOT EXISTS ix_fato_venda_produto ON dw.fato_venda_item (produto_key);
CREATE INDEX IF NOT EXISTS ix_fato_venda_data ON dw.fato_venda_item (data_key);

-- -----------------------------------------------------------------------------
-- fato_compra_item — GRÃO: a aquisição de uma peça registrada no cadastro
-- (produto com data de aquisição). Quantidade 1; custo = valor de aquisição.
-- A planilha não agrupa as peças em compras (notas): não existe identificador
-- de compra e nenhum é criado. Peças sem data de aquisição não entram.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.fato_compra_item (
    compra_item_key               bigint GENERATED ALWAYS AS IDENTITY,
    id_evento_origem              varchar(40)   NOT NULL,
    data_key                      integer       NOT NULL,
    data_hora_entrada             timestamp     NOT NULL,
    produto_key                   bigint        NOT NULL,
    parametro_preco_ouro_id       bigint,
    quantidade_recebida           integer       NOT NULL,
    custo_total_pago              numeric(14,2),
    custo_unitario                numeric(14,4) GENERATED ALWAYS AS (round(custo_total_pago / quantidade_recebida, 4)) STORED,
    indice_aplicado               numeric(14,4),
    preco_ouro_1000_aplicado      numeric(14,2),
    preco_sugerido_unitario       numeric(14,2),
    preco_venda_marcado_unitario  numeric(14,2),
    id_execucao                   bigint        NOT NULL,
    origem_dado                   varchar(20)   NOT NULL,
    CONSTRAINT pk_fato_compra_item PRIMARY KEY (compra_item_key),
    CONSTRAINT uq_fato_compra_evento UNIQUE (id_evento_origem),
    CONSTRAINT uq_fato_compra_produto UNIQUE (produto_key),
    CONSTRAINT fk_fato_compra_data FOREIGN KEY (data_key) REFERENCES dw.dim_data (data_key),
    CONSTRAINT fk_fato_compra_produto FOREIGN KEY (produto_key) REFERENCES dw.dim_produto (produto_key),
    CONSTRAINT fk_fato_compra_parametro FOREIGN KEY (parametro_preco_ouro_id) REFERENCES dw.parametro_preco_ouro (parametro_id),
    CONSTRAINT fk_fato_compra_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_fato_compra_data_key CHECK (data_key = dw.data_key(data_hora_entrada::date)),
    CONSTRAINT ck_fato_compra_quantidade CHECK (quantidade_recebida = 1),
    CONSTRAINT ck_fato_compra_custo CHECK (custo_total_pago IS NULL OR custo_total_pago >= 0),
    CONSTRAINT ck_fato_compra_indice CHECK (indice_aplicado IS NULL OR indice_aplicado > 0),
    CONSTRAINT ck_fato_compra_ouro_coerente CHECK ((parametro_preco_ouro_id IS NULL) = (preco_ouro_1000_aplicado IS NULL)),
    CONSTRAINT ck_fato_compra_origem CHECK (origem_dado IN ('APLICACAO', 'PLANILHA'))
);
COMMENT ON TABLE dw.fato_compra_item IS 'GRÃO: aquisição de uma peça (produto com data de aquisição), quantidade 1, custo = valor de aquisição. PLANILHA = peça importada; APLICACAO = peça cadastrada no sistema. Não há identificador de compra.';
COMMENT ON COLUMN dw.fato_compra_item.preco_ouro_1000_aplicado IS 'Preço do ouro vigente na data de aquisição (RN-67), quando houver registro.';
COMMENT ON COLUMN dw.fato_compra_item.preco_sugerido_unitario IS 'app.preco_sugerido(produto, data de aquisição) (RN-68). Vazio sem índice, sem preço do ouro vigente ou fora do material Ouro.';
COMMENT ON COLUMN dw.fato_compra_item.preco_venda_marcado_unitario IS 'Preço de venda do cadastro na data da carga (a aplicação não guarda histórico do preço de etiqueta).';

CREATE INDEX IF NOT EXISTS ix_fato_compra_data ON dw.fato_compra_item (data_key);

-- -----------------------------------------------------------------------------
-- fato_movimentacao_estoque — GRÃO: uma movimentação do banco operacional.
-- quantidade sempre positiva; o sinal vem do tipo. Vendas e estornos de venda
-- entram aqui; as vendas em si ficam em fato_venda_item (não somar as duas).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.fato_movimentacao_estoque (
    movimentacao_key   bigint GENERATED ALWAYS AS IDENTITY,
    id_evento_origem   varchar(40)   NOT NULL,
    data_key           integer       NOT NULL,
    data_hora_evento   timestamp     NOT NULL,
    produto_key        bigint        NOT NULL,
    tipo_mov_key       smallint      NOT NULL,
    quantidade         integer       NOT NULL,
    saldo_apos         integer       NOT NULL,
    custo_unitario     numeric(14,2),
    id_venda           bigint,
    registrado_em      timestamptz   NOT NULL,
    id_execucao        bigint        NOT NULL,
    origem_dado        varchar(20)   NOT NULL,
    CONSTRAINT pk_fato_movimentacao PRIMARY KEY (movimentacao_key),
    CONSTRAINT uq_fato_mov_evento UNIQUE (id_evento_origem),
    CONSTRAINT fk_fato_mov_data FOREIGN KEY (data_key) REFERENCES dw.dim_data (data_key),
    CONSTRAINT fk_fato_mov_produto FOREIGN KEY (produto_key) REFERENCES dw.dim_produto (produto_key),
    CONSTRAINT fk_fato_mov_tipo FOREIGN KEY (tipo_mov_key) REFERENCES dw.dim_tipo_movimentacao (tipo_mov_key),
    CONSTRAINT fk_fato_mov_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_fato_mov_data_key CHECK (data_key = dw.data_key(data_hora_evento::date)),
    CONSTRAINT ck_fato_mov_quantidade CHECK (quantidade > 0),
    CONSTRAINT ck_fato_mov_saldo CHECK (saldo_apos >= 0),
    CONSTRAINT ck_fato_mov_custo CHECK (custo_unitario IS NULL OR custo_unitario >= 0),
    CONSTRAINT ck_fato_mov_origem CHECK (origem_dado IN ('APLICACAO', 'PLANILHA'))
);
COMMENT ON TABLE dw.fato_movimentacao_estoque IS 'GRÃO: uma movimentação de estoque do banco operacional. data_hora_evento = data da ocorrência (sem hora). PLANILHA = implantação feita pela importação; APLICACAO = demais. Motivo e usuário não são levados ao DW.';
COMMENT ON COLUMN dw.fato_movimentacao_estoque.id_venda IS 'Número da venda da aplicação, nas saídas e estornos de venda.';

CREATE INDEX IF NOT EXISTS ix_fato_mov_produto_hora ON dw.fato_movimentacao_estoque (produto_key, data_hora_evento);
CREATE INDEX IF NOT EXISTS ix_fato_mov_data ON dw.fato_movimentacao_estoque (data_key);

-- -----------------------------------------------------------------------------
-- fato_snapshot_estoque — GRÃO: um produto em um dia (saldo no fim do dia).
-- DIÁRIO e somente a partir da data da importação das planilhas: nenhum saldo
-- anterior é reconstruído. Medida SEMIADITIVA.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.fato_snapshot_estoque (
    snapshot_key           bigint GENERATED ALWAYS AS IDENTITY,
    data_key               integer      NOT NULL,
    produto_key            bigint       NOT NULL,
    quantidade_em_estoque  integer      NOT NULL,
    id_execucao            bigint       NOT NULL,
    origem_dado            varchar(20)  NOT NULL DEFAULT 'APLICACAO',
    CONSTRAINT pk_fato_snapshot PRIMARY KEY (snapshot_key),
    CONSTRAINT uq_fato_snapshot_produto_data UNIQUE (produto_key, data_key),
    CONSTRAINT fk_fato_snapshot_data FOREIGN KEY (data_key) REFERENCES dw.dim_data (data_key),
    CONSTRAINT fk_fato_snapshot_produto FOREIGN KEY (produto_key) REFERENCES dw.dim_produto (produto_key),
    CONSTRAINT fk_fato_snapshot_execucao FOREIGN KEY (id_execucao) REFERENCES audit.execucao (id_execucao),
    CONSTRAINT ck_fato_snapshot_quantidade CHECK (quantidade_em_estoque >= 0),
    CONSTRAINT ck_fato_snapshot_origem CHECK (origem_dado = 'APLICACAO')
);
COMMENT ON TABLE dw.fato_snapshot_estoque IS 'GRÃO: produto × dia, da data da importação até a data de referência da carga. quantidade_em_estoque = Σ(quantidade × sinal) das movimentações com data de ocorrência até o dia. Semiaditivo: não somar no tempo.';

CREATE INDEX IF NOT EXISTS ix_fato_snapshot_data ON dw.fato_snapshot_estoque (data_key);
