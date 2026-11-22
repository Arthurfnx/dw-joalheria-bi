-- =============================================================================
-- bi_views.sql — views de consumo do Power BI sobre o DW REAL (esquema bi).
-- Mantêm os nomes e as colunas das views de bi_demo sempre que a informação
-- existe, para o relatório real ser uma cópia do demonstrativo ligada a bi.
-- Diferenças em relação a bi_demo:
--   - id_venda (número da venda da aplicação) substitui o identificador
--     artificial da fase 1; vazio nas vendas da planilha;
--   - fato_compra_item não tem identificador de compra (a fonte não tem);
--   - colunas novas: origem/faturamento das vendas, atributos do cadastro,
--     saldo após e custo das movimentações.
-- Nenhuma view expõe nome de pessoa, usuário, vendedor, motivo ou observação.
-- =============================================================================

-- Informação da carga (metadados para o relatório).
CREATE OR REPLACE VIEW bi.vw_info_ambiente AS
SELECT 'NOBREZA JOIAS'::text AS ambiente,
       'Dados do sistema de gestão da Nobreza Jóias. Vendas anteriores ao sistema vêm da planilha da loja, sem número de venda; ticket médio e associação usam só as vendas registradas no sistema.'::text AS aviso,
       'APLICACAO/PLANILHA'::text AS origem_dado,
       c.id_execucao AS id_ultima_execucao,
       e.status AS status_ultima_execucao,
       c.extraido_em AS ultima_carga_em,
       c.data_referencia,
       c.data_inicio_estoque,
       c.fator_preco_ouro,
       (SELECT min(data) FROM dw.dim_data) AS periodo_inicio,
       (SELECT max(data) FROM dw.dim_data) AS periodo_fim
  FROM (SELECT 1 AS um) base
  LEFT JOIN dw.controle_carga c ON c.id = 1
  LEFT JOIN audit.execucao e ON e.id_execucao = c.id_execucao;

-- Dimensões ---------------------------------------------------------------------
CREATE OR REPLACE VIEW bi.vw_dim_produto AS
SELECT produto_key, codigo_produto, descricao, material, tipo_peca, tamanho, peso_g,
       indice_precificacao, origem_dado,
       subcategoria, modo_controle, local_estoque, ativo, preco_venda, preco_sugerido_atual,
       valor_aquisicao, data_aquisicao
  FROM dw.dim_produto;

CREATE OR REPLACE VIEW bi.vw_dim_data AS
SELECT data_key, data, dia, mes, nome_mes, trimestre, ano, ano_mes, dia_semana, nome_dia_semana,
       fim_de_semana, data_comercial, janela_comercial, origem_dado
  FROM dw.dim_data;

CREATE OR REPLACE VIEW bi.vw_dim_tipo_movimentacao AS
SELECT tipo_mov_key, codigo_tipo, descricao_tipo, natureza, sinal, eh_venda, gera_faturamento, origem_dado
  FROM dw.dim_tipo_movimentacao;

-- Fatos -------------------------------------------------------------------------
CREATE OR REPLACE VIEW bi.vw_fato_compra_item AS
SELECT compra_item_key, id_evento_origem, data_key, data_hora_entrada,
       produto_key, parametro_preco_ouro_id, quantidade_recebida, custo_total_pago, custo_unitario,
       indice_aplicado, preco_ouro_1000_aplicado, preco_sugerido_unitario, preco_venda_marcado_unitario, origem_dado
  FROM dw.fato_compra_item;

CREATE OR REPLACE VIEW bi.vw_fato_venda_item AS
SELECT venda_item_key, id_venda, numero_item, id_evento_origem, data_key, data_hora_venda,
       produto_key, quantidade_vendida, preco_venda_marcado_unitario, preco_vendido_realizado_unitario,
       valor_marcado_total, valor_realizado_total, diferenca_marcado_realizado, origem_dado,
       valor_simbolico, entra_faturamento, valor_faturado
  FROM dw.fato_venda_item;

CREATE OR REPLACE VIEW bi.vw_fato_movimentacao_estoque AS
SELECT movimentacao_key, id_evento_origem, data_key, data_hora_evento, produto_key, tipo_mov_key,
       quantidade, origem_dado, saldo_apos, custo_unitario, id_venda
  FROM dw.fato_movimentacao_estoque;

CREATE OR REPLACE VIEW bi.vw_fato_snapshot_estoque AS
SELECT snapshot_key, data_key, produto_key, quantidade_em_estoque, origem_dado
  FROM dw.fato_snapshot_estoque;

-- Preço do ouro registrado pelo cliente (versões vigentes) e histórico ------------
CREATE OR REPLACE VIEW bi.vw_preco_ouro AS
SELECT dw.data_key(data_referencia) AS data_key, data_referencia, preco_ouro_1000,
       unidade_referencia, versao, origem_dado
  FROM dw.parametro_preco_ouro
 WHERE vigente;

CREATE OR REPLACE VIEW bi.vw_preco_ouro_versoes AS
SELECT parametro_id, data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente,
       substitui_parametro_id, motivo_correcao, criado_em, origem_dado
  FROM dw.parametro_preco_ouro;

-- Associação entre TIPOS DE PEÇA na mesma venda (período completo).
-- SOMENTE vendas registradas na aplicação, que têm número de venda (RN-73);
-- vazia até o cliente registrar vendas com mais de um tipo de peça.
-- Suporte = vendas com A e B / total; Confiança A→B = vendas com A e B / vendas
-- com A; Lift = confiança / (vendas com B / total).
CREATE OR REPLACE VIEW bi.vw_associacao_tipos AS
WITH venda_app AS (
    SELECT * FROM dw.fato_venda_item WHERE origem_dado = 'APLICACAO' AND id_venda IS NOT NULL
),
cesta AS (
    SELECT DISTINCT v.id_venda, p.tipo_peca
      FROM venda_app v
      JOIN dw.dim_produto p ON p.produto_key = v.produto_key
),
total AS (SELECT count(DISTINCT id_venda)::numeric AS n FROM venda_app),
freq AS (SELECT tipo_peca, count(*)::numeric AS n FROM cesta GROUP BY tipo_peca),
par AS (
    SELECT a.tipo_peca AS antecedente, b.tipo_peca AS consequente, count(*)::numeric AS n_ab
      FROM cesta a
      JOIN cesta b ON b.id_venda = a.id_venda AND b.tipo_peca <> a.tipo_peca
     GROUP BY a.tipo_peca, b.tipo_peca
)
SELECT par.antecedente,
       par.consequente,
       par.n_ab::bigint AS vendas_com_ambos,
       fa.n::bigint AS vendas_com_antecedente,
       fb.n::bigint AS vendas_com_consequente,
       total.n::bigint AS total_vendas,
       round(par.n_ab / total.n, 6) AS suporte,
       round(par.n_ab / fa.n, 6) AS confianca,
       round((par.n_ab / fa.n) / (fb.n / total.n), 6) AS lift,
       'APLICACAO'::text AS origem_dado
  FROM par
  JOIN freq fa ON fa.tipo_peca = par.antecedente
  JOIN freq fb ON fb.tipo_peca = par.consequente
 CROSS JOIN total;

-- Associação entre PRODUTOS na mesma venda (período completo), só vendas da aplicação.
CREATE OR REPLACE VIEW bi.vw_associacao_produtos AS
WITH venda_app AS (
    SELECT * FROM dw.fato_venda_item WHERE origem_dado = 'APLICACAO' AND id_venda IS NOT NULL
),
cesta AS (
    SELECT DISTINCT v.id_venda, v.produto_key
      FROM venda_app v
),
total AS (SELECT count(DISTINCT id_venda)::numeric AS n FROM venda_app),
freq AS (SELECT produto_key, count(*)::numeric AS n FROM cesta GROUP BY produto_key),
par AS (
    SELECT a.produto_key AS produto_key_antecedente, b.produto_key AS produto_key_consequente, count(*)::numeric AS n_ab
      FROM cesta a
      JOIN cesta b ON b.id_venda = a.id_venda AND b.produto_key <> a.produto_key
     GROUP BY a.produto_key, b.produto_key
)
SELECT par.produto_key_antecedente,
       pa.codigo_produto AS codigo_antecedente,
       pa.material AS material_antecedente,
       pa.tipo_peca AS tipo_peca_antecedente,
       par.produto_key_consequente,
       pb.codigo_produto AS codigo_consequente,
       pb.material AS material_consequente,
       pb.tipo_peca AS tipo_peca_consequente,
       par.n_ab::bigint AS vendas_com_ambos,
       fa.n::bigint AS vendas_com_antecedente,
       fb.n::bigint AS vendas_com_consequente,
       total.n::bigint AS total_vendas,
       round(par.n_ab / total.n, 6) AS suporte,
       round(par.n_ab / fa.n, 6) AS confianca,
       round((par.n_ab / fa.n) / (fb.n / total.n), 6) AS lift,
       'APLICACAO'::text AS origem_dado
  FROM par
  JOIN freq fa ON fa.produto_key = par.produto_key_antecedente
  JOIN freq fb ON fb.produto_key = par.produto_key_consequente
  JOIN dw.dim_produto pa ON pa.produto_key = par.produto_key_antecedente
  JOIN dw.dim_produto pb ON pb.produto_key = par.produto_key_consequente
 CROSS JOIN total;

COMMENT ON VIEW bi.vw_info_ambiente IS 'Metadados da última carga do DW real (sem nenhum dado de pessoa).';
COMMENT ON VIEW bi.vw_fato_venda_item IS 'Vendas: APLICACAO (com número de venda) e PLANILHA (histórico, sem identificador). Faturamento = valor_faturado (sem valor simbólico).';
COMMENT ON VIEW bi.vw_associacao_tipos IS 'Associação entre tipos de peça, somente com vendas registradas na aplicação (RN-73).';
COMMENT ON VIEW bi.vw_associacao_produtos IS 'Associação entre produtos, somente com vendas registradas na aplicação (RN-73).';
