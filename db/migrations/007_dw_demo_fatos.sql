-- =============================================================================
-- 007_dw_demo_fatos.sql — tabelas fato do DW demonstrativo.
-- Quantidades em PEÇAS; valores em R$. Os fatos não se relacionam entre si no
-- modelo semântico; id_evento_origem serve apenas à rastreabilidade em SQL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fato_compra_item — GRÃO: um produto em uma entrada de mercadoria sintética.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.fato_compra_item (
    compra_item_key               bigint GENERATED ALWAYS AS IDENTITY,
    id_entrada_sintetica          varchar(20)   NOT NULL,
    numero_item                   smallint      NOT NULL,
    id_evento_origem              varchar(30)   NOT NULL,
    data_key                      integer       NOT NULL,
    data_hora_entrada             timestamp     NOT NULL,
    produto_key                   bigint        NOT NULL,
    parametro_preco_ouro_id       bigint,
    quantidade_recebida           integer       NOT NULL,
    custo_total_pago              numeric(14,2) NOT NULL,
    custo_unitario                numeric(14,4) GENERATED ALWAYS AS (round(custo_total_pago / quantidade_recebida, 4)) STORED,
    indice_aplicado               numeric(10,4) NOT NULL,
    preco_ouro_1000_aplicado      numeric(12,2),
    preco_sugerido_unitario       numeric(14,2),
    preco_venda_marcado_unitario  numeric(14,2) NOT NULL,
    id_execucao                   bigint        NOT NULL,
    origem_dado                   varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_fato_compra_item PRIMARY KEY (compra_item_key),
    CONSTRAINT uq_fato_compra_evento UNIQUE (id_evento_origem),
    CONSTRAINT uq_fato_compra_entrada_item UNIQUE (id_entrada_sintetica, numero_item),
    CONSTRAINT fk_fato_compra_data FOREIGN KEY (data_key) REFERENCES dw_demo.dim_data (data_key),
    CONSTRAINT fk_fato_compra_produto FOREIGN KEY (produto_key) REFERENCES dw_demo.dim_produto (produto_key),
    CONSTRAINT fk_fato_compra_parametro FOREIGN KEY (parametro_preco_ouro_id) REFERENCES dw_demo.parametro_preco_ouro (parametro_id),
    CONSTRAINT fk_fato_compra_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT ck_fato_compra_data_key CHECK (data_key = dw_demo.data_key(data_hora_entrada::date)),
    CONSTRAINT ck_fato_compra_quantidade CHECK (quantidade_recebida > 0),
    CONSTRAINT ck_fato_compra_custo CHECK (custo_total_pago > 0),
    CONSTRAINT ck_fato_compra_indice CHECK (indice_aplicado > 0),
    CONSTRAINT ck_fato_compra_marcado CHECK (preco_venda_marcado_unitario > 0),
    CONSTRAINT ck_fato_compra_ouro_coerente CHECK (
        (parametro_preco_ouro_id IS NULL) = (preco_ouro_1000_aplicado IS NULL)
        AND (preco_ouro_1000_aplicado IS NULL) = (preco_sugerido_unitario IS NULL)),
    CONSTRAINT ck_fato_compra_sugerido_formula CHECK (
        preco_sugerido_unitario IS NULL
        OR preco_sugerido_unitario = dw_demo.calcular_preco_sugerido(preco_ouro_1000_aplicado, indice_aplicado)),
    CONSTRAINT ck_fato_compra_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.fato_compra_item IS 'GRÃO: um produto em uma entrada de mercadoria sintética. Custo pertence à entrada; nunca é sobrescrito.';
COMMENT ON COLUMN dw_demo.fato_compra_item.custo_unitario IS 'Derivado: custo_total_pago ÷ quantidade_recebida.';
COMMENT ON COLUMN dw_demo.fato_compra_item.preco_ouro_1000_aplicado IS 'Cópia histórica do valor da versão usada (Ouro/Prata). NULL para Folheado.';
COMMENT ON COLUMN dw_demo.fato_compra_item.preco_sugerido_unitario IS 'Regra confirmada (Ouro/Prata): preço do ouro × 1,6 × índice. NULL para Folheado.';

CREATE INDEX IF NOT EXISTS ix_fato_compra_produto ON dw_demo.fato_compra_item (produto_key);
CREATE INDEX IF NOT EXISTS ix_fato_compra_data ON dw_demo.fato_compra_item (data_key);

-- Regras dependentes do material e da data do parâmetro (não expressáveis em CHECK).
CREATE OR REPLACE FUNCTION dw_demo.tg_fato_compra_item_regras()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_material  varchar(20);
    v_param     dw_demo.parametro_preco_ouro%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'fato_compra_item: registros de aquisição não podem ser alterados (id_evento_origem=%).', OLD.id_evento_origem;
    END IF;

    SELECT material INTO v_material FROM dw_demo.dim_produto WHERE produto_key = NEW.produto_key;

    IF v_material IN ('Ouro', 'Prata') THEN
        IF NEW.parametro_preco_ouro_id IS NULL THEN
            RAISE EXCEPTION 'fato_compra_item: entrada de % exige parâmetro de preço do ouro (id_evento_origem=%).', v_material, NEW.id_evento_origem;
        END IF;
        SELECT * INTO v_param FROM dw_demo.parametro_preco_ouro WHERE parametro_id = NEW.parametro_preco_ouro_id;
        IF v_param.data_referencia <> NEW.data_hora_entrada::date THEN
            RAISE EXCEPTION 'fato_compra_item: o parâmetro do ouro deve ser da mesma data da entrada (id_evento_origem=%).', NEW.id_evento_origem;
        END IF;
        IF v_param.preco_ouro_1000 <> NEW.preco_ouro_1000_aplicado THEN
            RAISE EXCEPTION 'fato_compra_item: preco_ouro_1000_aplicado diverge do parâmetro referenciado (id_evento_origem=%).', NEW.id_evento_origem;
        END IF;
    ELSIF v_material = 'Folheado' THEN
        IF NEW.parametro_preco_ouro_id IS NOT NULL OR NEW.preco_sugerido_unitario IS NOT NULL THEN
            RAISE EXCEPTION 'fato_compra_item: Folheado não usa a fórmula do ouro (id_evento_origem=%).', NEW.id_evento_origem;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tg_fato_compra_item_regras
    BEFORE INSERT OR UPDATE ON dw_demo.fato_compra_item
    FOR EACH ROW EXECUTE FUNCTION dw_demo.tg_fato_compra_item_regras();

-- -----------------------------------------------------------------------------
-- fato_venda_item — GRÃO: um produto em uma transação de venda sintética.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.fato_venda_item (
    venda_item_key                    bigint GENERATED ALWAYS AS IDENTITY,
    id_venda_sintetica                varchar(20)   NOT NULL,
    numero_item                       smallint      NOT NULL,
    id_evento_origem                  varchar(30)   NOT NULL,
    data_key                          integer       NOT NULL,
    data_hora_venda                   timestamp     NOT NULL,
    produto_key                       bigint        NOT NULL,
    quantidade_vendida                integer       NOT NULL,
    preco_venda_marcado_unitario      numeric(14,2) NOT NULL,
    preco_vendido_realizado_unitario  numeric(14,2) NOT NULL,
    valor_marcado_total               numeric(14,2) GENERATED ALWAYS AS (quantidade_vendida * preco_venda_marcado_unitario) STORED,
    valor_realizado_total             numeric(14,2) GENERATED ALWAYS AS (quantidade_vendida * preco_vendido_realizado_unitario) STORED,
    diferenca_marcado_realizado       numeric(14,2) GENERATED ALWAYS AS (quantidade_vendida * (preco_venda_marcado_unitario - preco_vendido_realizado_unitario)) STORED,
    id_execucao                       bigint        NOT NULL,
    origem_dado                       varchar(20)   NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_fato_venda_item PRIMARY KEY (venda_item_key),
    CONSTRAINT uq_fato_venda_evento UNIQUE (id_evento_origem),
    CONSTRAINT uq_fato_venda_venda_item UNIQUE (id_venda_sintetica, numero_item),
    CONSTRAINT fk_fato_venda_data FOREIGN KEY (data_key) REFERENCES dw_demo.dim_data (data_key),
    CONSTRAINT fk_fato_venda_produto FOREIGN KEY (produto_key) REFERENCES dw_demo.dim_produto (produto_key),
    CONSTRAINT fk_fato_venda_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT ck_fato_venda_data_key CHECK (data_key = dw_demo.data_key(data_hora_venda::date)),
    CONSTRAINT ck_fato_venda_quantidade CHECK (quantidade_vendida > 0),
    CONSTRAINT ck_fato_venda_marcado CHECK (preco_venda_marcado_unitario > 0),
    CONSTRAINT ck_fato_venda_realizado CHECK (preco_vendido_realizado_unitario > 0),
    CONSTRAINT ck_fato_venda_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.fato_venda_item IS 'GRÃO: um produto em uma transação de venda SINTÉTICA. id_venda_sintetica é artificial (inexistente na fonte real). Faturamento = valor_realizado_total. Sem restrição entre preço realizado e marcado.';
COMMENT ON COLUMN dw_demo.fato_venda_item.diferenca_marcado_realizado IS 'Positiva = desconto; negativa = venda acima do preço marcado.';

CREATE INDEX IF NOT EXISTS ix_fato_venda_produto ON dw_demo.fato_venda_item (produto_key);
CREATE INDEX IF NOT EXISTS ix_fato_venda_data ON dw_demo.fato_venda_item (data_key);

-- -----------------------------------------------------------------------------
-- fato_movimentacao_estoque — GRÃO: um evento individual de movimentação de um
-- produto, com data/hora, tipo e quantidade POSITIVA (sinal vem do tipo).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.fato_movimentacao_estoque (
    movimentacao_key   bigint GENERATED ALWAYS AS IDENTITY,
    id_evento_origem   varchar(30)  NOT NULL,
    data_key           integer      NOT NULL,
    data_hora_evento   timestamp    NOT NULL,
    produto_key        bigint       NOT NULL,
    tipo_mov_key       smallint     NOT NULL,
    quantidade         integer      NOT NULL,
    id_execucao        bigint       NOT NULL,
    origem_dado        varchar(20)  NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_fato_movimentacao PRIMARY KEY (movimentacao_key),
    CONSTRAINT uq_fato_mov_evento UNIQUE (id_evento_origem),
    CONSTRAINT fk_fato_mov_data FOREIGN KEY (data_key) REFERENCES dw_demo.dim_data (data_key),
    CONSTRAINT fk_fato_mov_produto FOREIGN KEY (produto_key) REFERENCES dw_demo.dim_produto (produto_key),
    CONSTRAINT fk_fato_mov_tipo FOREIGN KEY (tipo_mov_key) REFERENCES dw_demo.dim_tipo_movimentacao (tipo_mov_key),
    CONSTRAINT fk_fato_mov_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT ck_fato_mov_data_key CHECK (data_key = dw_demo.data_key(data_hora_evento::date)),
    CONSTRAINT ck_fato_mov_quantidade CHECK (quantidade > 0),
    CONSTRAINT ck_fato_mov_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.fato_movimentacao_estoque IS 'GRÃO: um evento de movimentação de um produto. quantidade = magnitude (> 0); saldo = Σ(quantidade × dim_tipo_movimentacao.sinal).';

CREATE INDEX IF NOT EXISTS ix_fato_mov_produto_hora ON dw_demo.fato_movimentacao_estoque (produto_key, data_hora_evento);
CREATE INDEX IF NOT EXISTS ix_fato_mov_data ON dw_demo.fato_movimentacao_estoque (data_key);

-- -----------------------------------------------------------------------------
-- fato_snapshot_estoque — GRÃO: um produto em uma data de referência
-- (saldo no fechamento do dia). Medida SEMIADITIVA.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_demo.fato_snapshot_estoque (
    snapshot_key           bigint GENERATED ALWAYS AS IDENTITY,
    data_key               integer      NOT NULL,
    produto_key            bigint       NOT NULL,
    quantidade_em_estoque  integer      NOT NULL,
    id_execucao            bigint       NOT NULL,
    origem_dado            varchar(20)  NOT NULL DEFAULT 'SINTETICO_DEMO',
    CONSTRAINT pk_fato_snapshot PRIMARY KEY (snapshot_key),
    CONSTRAINT uq_fato_snapshot_produto_data UNIQUE (produto_key, data_key),
    CONSTRAINT fk_fato_snapshot_data FOREIGN KEY (data_key) REFERENCES dw_demo.dim_data (data_key),
    CONSTRAINT fk_fato_snapshot_produto FOREIGN KEY (produto_key) REFERENCES dw_demo.dim_produto (produto_key),
    CONSTRAINT fk_fato_snapshot_execucao FOREIGN KEY (id_execucao) REFERENCES audit_demo.execucao (id_execucao),
    CONSTRAINT ck_fato_snapshot_quantidade CHECK (quantidade_em_estoque >= 0),
    CONSTRAINT ck_fato_snapshot_origem CHECK (origem_dado = 'SINTETICO_DEMO')
);
COMMENT ON TABLE dw_demo.fato_snapshot_estoque IS 'GRÃO: produto × data de referência (fim de mês). quantidade_em_estoque = Σ(quantidade × sinal) até o fim do dia. Semiaditivo: não somar no tempo.';

CREATE INDEX IF NOT EXISTS ix_fato_snapshot_data ON dw_demo.fato_snapshot_estoque (data_key);
