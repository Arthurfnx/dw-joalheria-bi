-- =============================================================================
-- bi_demo_views.sql — views de consumo do Power BI (AMBIENTE DEMONSTRATIVO).
-- Não expõem atributos técnicos do gerador (perfil) nem dados de clientes.
-- As views reais da fase 2 devem manter os mesmos nomes de colunas.
-- =============================================================================

-- Informação do ambiente (alimenta o aviso obrigatório nos painéis).
CREATE OR REPLACE VIEW bi_demo.vw_info_ambiente AS
SELECT 'DEMONSTRATIVO'::text AS ambiente,
       'AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.'::text AS aviso,
       'SINTETICO_DEMO'::text AS origem_dado,
       c.semente,
       c.hash_configuracao,
       c.ultima_execucao AS id_ultima_execucao,
       e.status AS status_ultima_execucao,
       e.finalizado_em AS ultima_carga_em,
       (SELECT min(data) FROM dw_demo.dim_data) AS periodo_inicio,
       (SELECT max(data) FROM dw_demo.dim_data) AS periodo_fim
  FROM (SELECT 1 AS um) base
  LEFT JOIN dw_demo.controle_carga c ON c.id = 1
  LEFT JOIN audit_demo.execucao e ON e.id_execucao = c.ultima_execucao;

-- Dimensões ---------------------------------------------------------------------
CREATE OR REPLACE VIEW bi_demo.vw_dim_produto AS
SELECT produto_key, codigo_produto, descricao, material, tipo_peca, tamanho, peso_g,
       indice_precificacao, origem_dado
  FROM dw_demo.dim_produto;

CREATE OR REPLACE VIEW bi_demo.vw_dim_data AS
SELECT data_key, data, dia, mes, nome_mes, trimestre, ano, ano_mes, dia_semana, nome_dia_semana,
       fim_de_semana, data_comercial, janela_comercial, origem_dado
  FROM dw_demo.dim_data;

CREATE OR REPLACE VIEW bi_demo.vw_dim_tipo_movimentacao AS
SELECT tipo_mov_key, codigo_tipo, descricao_tipo, natureza, sinal, eh_venda, gera_faturamento, origem_dado
  FROM dw_demo.dim_tipo_movimentacao;

-- Fatos -------------------------------------------------------------------------
CREATE OR REPLACE VIEW bi_demo.vw_fato_compra_item AS
SELECT compra_item_key, id_entrada_sintetica, numero_item, id_evento_origem, data_key, data_hora_entrada,
       produto_key, parametro_preco_ouro_id, quantidade_recebida, custo_total_pago, custo_unitario,
       indice_aplicado, preco_ouro_1000_aplicado, preco_sugerido_unitario, preco_venda_marcado_unitario, origem_dado
  FROM dw_demo.fato_compra_item;

CREATE OR REPLACE VIEW bi_demo.vw_fato_venda_item AS
SELECT venda_item_key, id_venda_sintetica, numero_item, id_evento_origem, data_key, data_hora_venda,
       produto_key, quantidade_vendida, preco_venda_marcado_unitario, preco_vendido_realizado_unitario,
       valor_marcado_total, valor_realizado_total, diferenca_marcado_realizado, origem_dado
  FROM dw_demo.fato_venda_item;

CREATE OR REPLACE VIEW bi_demo.vw_fato_movimentacao_estoque AS
SELECT movimentacao_key, id_evento_origem, data_key, data_hora_evento, produto_key, tipo_mov_key,
       quantidade, origem_dado
  FROM dw_demo.fato_movimentacao_estoque;

CREATE OR REPLACE VIEW bi_demo.vw_fato_snapshot_estoque AS
SELECT snapshot_key, data_key, produto_key, quantidade_em_estoque, origem_dado
  FROM dw_demo.fato_snapshot_estoque;

-- Preço do ouro (somente versões vigentes) e histórico de versões ----------------
CREATE OR REPLACE VIEW bi_demo.vw_preco_ouro AS
SELECT dw_demo.data_key(data_referencia) AS data_key, data_referencia, preco_ouro_1000,
       unidade_referencia, versao, origem_dado
  FROM dw_demo.parametro_preco_ouro
 WHERE vigente;

CREATE OR REPLACE VIEW bi_demo.vw_preco_ouro_versoes AS
SELECT parametro_id, data_referencia, versao, preco_ouro_1000, unidade_referencia, vigente,
       substitui_parametro_id, motivo_correcao, criado_em, origem_dado
  FROM dw_demo.parametro_preco_ouro;

-- Associação entre TIPOS DE PEÇA na mesma venda sintética (período completo).
-- Suporte = vendas com A e B / total; Confiança A→B = vendas com A e B / vendas com A;
-- Lift = confiança / (vendas com B / total). Somente com identificadores SINTÉTICOS.
CREATE OR REPLACE VIEW bi_demo.vw_associacao_tipos AS
WITH cesta AS (
    SELECT DISTINCT v.id_venda_sintetica, p.tipo_peca
      FROM dw_demo.fato_venda_item v
      JOIN dw_demo.dim_produto p ON p.produto_key = v.produto_key
),
total AS (SELECT count(DISTINCT id_venda_sintetica)::numeric AS n FROM dw_demo.fato_venda_item),
freq AS (SELECT tipo_peca, count(*)::numeric AS n FROM cesta GROUP BY tipo_peca),
par AS (
    SELECT a.tipo_peca AS antecedente, b.tipo_peca AS consequente, count(*)::numeric AS n_ab
      FROM cesta a
      JOIN cesta b ON b.id_venda_sintetica = a.id_venda_sintetica AND b.tipo_peca <> a.tipo_peca
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
       'SINTETICO_DEMO'::text AS origem_dado
  FROM par
  JOIN freq fa ON fa.tipo_peca = par.antecedente
  JOIN freq fb ON fb.tipo_peca = par.consequente
 CROSS JOIN total;

-- Associação entre PRODUTOS na mesma venda sintética (período completo).
CREATE OR REPLACE VIEW bi_demo.vw_associacao_produtos AS
WITH cesta AS (
    SELECT DISTINCT v.id_venda_sintetica, v.produto_key
      FROM dw_demo.fato_venda_item v
),
total AS (SELECT count(DISTINCT id_venda_sintetica)::numeric AS n FROM dw_demo.fato_venda_item),
freq AS (SELECT produto_key, count(*)::numeric AS n FROM cesta GROUP BY produto_key),
par AS (
    SELECT a.produto_key AS produto_key_antecedente, b.produto_key AS produto_key_consequente, count(*)::numeric AS n_ab
      FROM cesta a
      JOIN cesta b ON b.id_venda_sintetica = a.id_venda_sintetica AND b.produto_key <> a.produto_key
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
       'SINTETICO_DEMO'::text AS origem_dado
  FROM par
  JOIN freq fa ON fa.produto_key = par.produto_key_antecedente
  JOIN freq fb ON fb.produto_key = par.produto_key_consequente
  JOIN dw_demo.dim_produto pa ON pa.produto_key = par.produto_key_antecedente
  JOIN dw_demo.dim_produto pb ON pb.produto_key = par.produto_key_consequente
 CROSS JOIN total;

COMMENT ON VIEW bi_demo.vw_info_ambiente IS 'Aviso obrigatório e metadados do ambiente DEMONSTRATIVO.';
COMMENT ON VIEW bi_demo.vw_associacao_tipos IS 'Associação entre tipos de peça (período completo) com IDs de venda SINTÉTICOS. Afinidades foram inseridas pelo gerador.';
COMMENT ON VIEW bi_demo.vw_associacao_produtos IS 'Associação entre produtos (período completo) com IDs de venda SINTÉTICOS.';
