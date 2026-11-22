-- =============================================================================
-- 103_staging.sql — staging do DW real. Recebe, a cada execução, os CSV
-- extraídos de nobreza_app pelo papel nobreza_leitura_dw, que não lê
-- consignado_com, local_original, usuário, sessão nem auditoria (seção 6A da
-- especificação). As extrações (etl/sql/app/01_extrair_app.sql) também não
-- trazem textos livres (observação, motivo) nem quem registrou cada operação.
--
-- Os nomes de coluna são os do cabeçalho dos CSV (COPY ... HEADER MATCH).
-- Sem restrições além dos tipos: as regras são conferidas na validação
-- (etl/sql/app/20_validar_staging.sql), para que nada seja descartado em
-- silêncio. Recarga completa: o ETL esvazia estas tabelas a cada execução.
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging.produto (
    id                        bigint,
    codigo                    text,
    descricao                 text,
    material                  text,
    categoria                 text,
    usa_tamanho               boolean,
    subcategoria              text,
    modo_controle             text,
    peso_gramas               numeric(10,3),
    tamanho                   text,
    pedras                    text,
    preco_venda               numeric(14,2),
    indice_preco              numeric(14,4),
    valor_aquisicao           numeric(14,2),
    data_aquisicao            date,
    local_estoque             text,
    ativo                     boolean,
    criado_em                 timestamptz,
    importado_planilha        boolean,
    situacao_original         text,
    preco_sugerido_atual      numeric(14,2),
    preco_sugerido_aquisicao  numeric(14,2)
);
COMMENT ON TABLE staging.produto IS 'Produtos com material, categoria e subcategoria por nome. local_estoque só traz os locais fixos (Consignado, sem o nome). preco_sugerido_* vêm de app.preco_sugerido (RN-68).';

CREATE TABLE IF NOT EXISTS staging.tipo_movimentacao (
    codigo          text,
    descricao       text,
    sinal           smallint,
    eh_venda        boolean,
    exige_motivo    boolean,
    origem_exigida  text,
    uso_manual      boolean
);

CREATE TABLE IF NOT EXISTS staging.venda (
    id              bigint,
    numero          bigint,
    data_venda      date,
    situacao        text,
    valor_total     numeric(14,2),
    registrada_em   timestamptz
);
COMMENT ON TABLE staging.venda IS 'Vendas da aplicação. Vendedor, observação e motivo de cancelamento não são extraídos.';

CREATE TABLE IF NOT EXISTS staging.venda_item (
    id               bigint,
    venda_id         bigint,
    produto_id       bigint,
    quantidade       integer,
    preco_tabela     numeric(14,2),
    preco_praticado  numeric(14,2),
    valor_item       numeric(14,2)
);

CREATE TABLE IF NOT EXISTS staging.venda_historica (
    id            bigint,
    produto_id    bigint,
    data_venda    date,
    valor_venda   numeric(14,2),
    valor_compra  numeric(14,2),
    simbolico     boolean
);
COMMENT ON TABLE staging.venda_historica IS 'Vendas importadas da planilha: sem número de venda e sem cliente.';

CREATE TABLE IF NOT EXISTS staging.preco_ouro (
    id             bigint,
    valor_grama    numeric(14,2),
    vigente_desde  date,
    registrado_em  timestamptz
);
COMMENT ON TABLE staging.preco_ouro IS 'Registros do preço do ouro feitos pelo cliente. Quem registrou não é extraído.';

CREATE TABLE IF NOT EXISTS staging.movimentacao_estoque (
    id               bigint,
    produto_id       bigint,
    tipo_codigo      text,
    quantidade       integer,
    saldo_apos       integer,
    custo_unitario   numeric(14,2),
    venda_item_id    bigint,
    compra_item_id   bigint,
    estorna_id       bigint,
    data_ocorrencia  date,
    registrada_em    timestamptz
);
COMMENT ON TABLE staging.movimentacao_estoque IS 'Movimentações. Motivo (texto livre) e usuário não são extraídos.';

CREATE TABLE IF NOT EXISTS staging.saldo_estoque (
    produto_id  bigint,
    quantidade  integer
);

CREATE TABLE IF NOT EXISTS staging.importacao_lote (
    id            bigint,
    iniciado_em   timestamptz,
    concluido_em  timestamptz
);
COMMENT ON TABLE staging.importacao_lote IS 'Lotes da importação das planilhas: só as datas (definem o início dos snapshots).';

CREATE TABLE IF NOT EXISTS staging.configuracao (
    chave  text,
    valor  text
);
COMMENT ON TABLE staging.configuracao IS 'Somente as chaves usadas pelo DW (fator_preco_ouro).';

CREATE TABLE IF NOT EXISTS staging.extracao (
    tabela           text,
    linhas           bigint,
    extraido_em      timestamptz,
    data_referencia  date
);
COMMENT ON TABLE staging.extracao IS 'Contagem de linhas de cada tabela de origem, medida no banco operacional na mesma transação da extração (origem × destino). data_referencia = data corrente em America/Sao_Paulo.';
