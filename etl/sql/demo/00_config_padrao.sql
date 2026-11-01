-- =============================================================================
-- 00_config_padrao.sql — VALORES PADRÃO da simulação (DEMO).
-- Todos são SUGESTÕES CONFIGURÁVEIS para demonstração acadêmica, NÃO fatos
-- sobre a empresa. Inseridos com ON CONFLICT DO NOTHING: edições feitas pelo
-- usuário em config_demo NÃO são sobrescritas ao reaplicar este arquivo.
-- Alterar a configuração muda o hash e exige reset controlado da demo.
-- =============================================================================

INSERT INTO config_demo.parametro (chave, valor, tipo, natureza, descricao) VALUES
    ('semente',                       '20261031',   'inteiro', 'CONTROLE',         'Semente do gerador determinístico.'),
    ('data_inicio',                   '2024-01-01', 'data',    'REGRA_SIMULACAO',  'Início do período simulado (2 anos completos permitem comparação ano a ano).'),
    ('data_fim',                      '2025-12-31', 'data',    'REGRA_SIMULACAO',  'Fim do período simulado.'),
    ('hora_abertura',                 '9',          'inteiro', 'REGRA_SIMULACAO',  'Hora de abertura simulada (entradas ocorrem neste horário).'),
    ('hora_fechamento',               '18',         'inteiro', 'REGRA_SIMULACAO',  'Hora de fechamento simulada (ajustes de inventário ocorrem neste horário).'),
    ('vendas_base_dia',               '6',          'decimal', 'REGRA_SIMULACAO',  'Média base de transações por dia de funcionamento (antes dos fatores).'),
    ('prob_venda_2_itens',            '0.25',       'decimal', 'REGRA_SIMULACAO',  'Probabilidade de uma venda ter 2 itens.'),
    ('prob_venda_3_itens',            '0.10',       'decimal', 'REGRA_SIMULACAO',  'Probabilidade de uma venda ter 3 itens.'),
    ('prob_item_por_afinidade',       '0.60',       'decimal', 'PADRAO_SINTETICO', 'Probabilidade de um item adicional seguir config_demo.afinidade_tipo.'),
    ('prob_quantidade_2',             '0.08',       'decimal', 'REGRA_SIMULACAO',  'Probabilidade de um item ser vendido com quantidade 2 (se houver saldo).'),
    ('prob_preco_igual',              '0.50',       'decimal', 'PADRAO_SINTETICO', 'Proporção de itens vendidos pelo preço marcado.'),
    ('prob_preco_abaixo',             '0.42',       'decimal', 'PADRAO_SINTETICO', 'Proporção de itens vendidos abaixo do marcado (o restante é acima).'),
    ('desconto_min',                  '0.03',       'decimal', 'PADRAO_SINTETICO', 'Desconto mínimo sintético sobre o marcado.'),
    ('desconto_max',                  '0.15',       'decimal', 'PADRAO_SINTETICO', 'Desconto máximo sintético sobre o marcado.'),
    ('acrescimo_min',                 '0.01',       'decimal', 'PADRAO_SINTETICO', 'Acréscimo mínimo sintético sobre o marcado.'),
    ('acrescimo_max',                 '0.05',       'decimal', 'PADRAO_SINTETICO', 'Acréscimo máximo sintético sobre o marcado.'),
    ('tolerancia_proporcao_preco',    '0.05',       'decimal', 'CONTROLE',         'Tolerância absoluta na verificação COM-02.'),
    ('arredondamento_preco_marcado',  '5',          'decimal', 'REGRA_SIMULACAO',  'Múltiplo (R$) de arredondamento do preço marcado sintético.'),
    ('preco_ouro_base',               '400.00',     'decimal', 'REGRA_SIMULACAO',  'Valor inicial FICTÍCIO da série do preço do ouro 1000 (unidade NAO_CONFIRMADA_DEMO).'),
    ('preco_ouro_variacao_diaria_max','0.010',      'decimal', 'REGRA_SIMULACAO',  'Variação diária máxima (±) da série fictícia do preço do ouro.'),
    ('reposicao_saldo_gatilho',       '1',          'inteiro', 'REGRA_SIMULACAO',  'Gatilho TÉCNICO de reposição da simulação. NÃO é estoque mínimo do parceiro.'),
    ('reposicao_prazo_min_dias',      '5',          'inteiro', 'REGRA_SIMULACAO',  'Prazo mínimo (dias) entre o gatilho e a chegada da reposição.'),
    ('reposicao_prazo_max_dias',      '15',         'inteiro', 'REGRA_SIMULACAO',  'Prazo máximo (dias) entre o gatilho e a chegada da reposição.'),
    ('reforco_ciclo_dias',            '30',         'inteiro', 'REGRA_SIMULACAO',  'A cada N dias, produtos de giro alto/médio podem receber compra de reforço.'),
    ('reforco_probabilidade',         '0.15',       'decimal', 'REGRA_SIMULACAO',  'Probabilidade de reforço por produto elegível em cada ciclo.'),
    ('presente_prob_dia',             '0.04',       'decimal', 'REGRA_SIMULACAO',  'Probabilidade diária (dia de funcionamento) de uma saída por presente.'),
    ('roubos_por_ano',                '0',          'decimal', 'REGRA_SIMULACAO',  'Roubos NÃO fazem parte da simulação padrão desta fase (0 = desativado). O tipo SAIDA_ROUBO permanece na dimensão para evolução futura.'),
    ('ajuste_intervalo_meses',        '3',          'inteiro', 'REGRA_SIMULACAO',  'Intervalo (meses) entre contagens de inventário simuladas.'),
    ('ajuste_dia_mes',                '15',         'inteiro', 'REGRA_SIMULACAO',  'Dia do mês das contagens de inventário simuladas.'),
    ('ajuste_fracao_produtos',        '0.05',       'decimal', 'REGRA_SIMULACAO',  'Fração de produtos com divergência (±1) em cada contagem.'),
    ('interrompido_meses_finais',     '6',          'inteiro', 'REGRA_SIMULACAO',  'Produtos de perfil "interrompido" não vendem nos últimos N meses.'),
    ('frequencia_snapshot',           'MENSAL',     'texto',   'REGRA_SIMULACAO',  'Datas de referência dos snapshots. Implementado: MENSAL (último dia do mês + data_fim).')
ON CONFLICT (chave) DO NOTHING;

-- Materiais. Ouro: indice_min/max = índice POR GRAMA. Custos e markups SINTÉTICOS.
INSERT INTO config_demo.material
    (material, prefixo_codigo, qtd_produtos, saldo_inicial_min, saldo_inicial_max,
     lote_reposicao_min, lote_reposicao_max, indice_min, indice_max,
     fator_custo_min, fator_custo_max, markup_min, markup_max, variacao_marcado_max)
VALUES
    ('Ouro',     'OURO',    50, 1, 3, 1,  3, 0.9000, 1.2000, 0.8500, 1.0000, NULL,   NULL,   0.0500),
    ('Prata',    'PRATA',   50, 2, 6, 3,  8, 0.1000, 0.6000, 0.8500, 1.0000, NULL,   NULL,   0.0500),
    ('Folheado', 'FOLHADO', 50, 3, 8, 4, 10, 0.0500, 0.4000, NULL,   NULL,   2.0000, 3.0000, 0.0000)
ON CONFLICT (material) DO NOTHING;

-- Tipos de peça. Tamanho obrigatório somente para Anel nesta demo.
INSERT INTO config_demo.tipo_peca
    (tipo_peca, exige_tamanho, tamanho_min, tamanho_max, peso_ouro_min_g, peso_ouro_max_g, custo_folheado_min, custo_folheado_max)
VALUES
    ('Anel',         true,  10,   30,   1.000,  6.000,  8.00, 40.00),
    ('Aliança',      false, NULL, NULL, 2.000,  8.000, 10.00, 45.00),
    ('Brinco',       false, NULL, NULL, 0.500,  4.000,  5.00, 35.00),
    ('Pingente',     false, NULL, NULL, 0.500,  3.000,  5.00, 30.00),
    ('Colar',        false, NULL, NULL, 3.000, 15.000, 15.00, 60.00),
    ('Cordão',       false, NULL, NULL, 2.000, 12.000, 12.00, 50.00),
    ('Corrente',     false, NULL, NULL, 2.000, 12.000, 12.00, 50.00),
    ('Pulseira',     false, NULL, NULL, 2.000, 10.000, 10.00, 45.00),
    ('Tornozeleira', false, NULL, NULL, 1.000,  5.000,  8.00, 35.00),
    ('Conjunto',     false, NULL, NULL, 3.000, 12.000, 20.00, 80.00)
ON CONFLICT (tipo_peca) DO NOTHING;

-- Distribuição de tipos por material: todas as combinações são permitidas.
INSERT INTO config_demo.distribuicao_tipo (material, tipo_peca, peso) VALUES
    ('Ouro', 'Anel', 25), ('Ouro', 'Aliança', 10), ('Ouro', 'Brinco', 20), ('Ouro', 'Pingente', 12),
    ('Ouro', 'Colar', 6), ('Ouro', 'Cordão', 8), ('Ouro', 'Corrente', 8), ('Ouro', 'Pulseira', 6),
    ('Ouro', 'Tornozeleira', 2), ('Ouro', 'Conjunto', 3),
    ('Prata', 'Anel', 20), ('Prata', 'Aliança', 5), ('Prata', 'Brinco', 22), ('Prata', 'Pingente', 12),
    ('Prata', 'Colar', 8), ('Prata', 'Cordão', 8), ('Prata', 'Corrente', 8), ('Prata', 'Pulseira', 8),
    ('Prata', 'Tornozeleira', 5), ('Prata', 'Conjunto', 4),
    ('Folheado', 'Anel', 20), ('Folheado', 'Aliança', 3), ('Folheado', 'Brinco', 25), ('Folheado', 'Pingente', 10),
    ('Folheado', 'Colar', 10), ('Folheado', 'Cordão', 6), ('Folheado', 'Corrente', 8), ('Folheado', 'Pulseira', 10),
    ('Folheado', 'Tornozeleira', 5), ('Folheado', 'Conjunto', 3)
ON CONFLICT (material, tipo_peca) DO NOTHING;

-- Perfis técnicos de movimentação (proporções devem somar 1).
INSERT INTO config_demo.perfil_movimentacao (perfil, ordem, proporcao, peso_venda, descricao) VALUES
    ('alta',         1, 0.2000, 10, 'Giro alto (sintético).'),
    ('media',        2, 0.4000,  4, 'Giro médio (sintético).'),
    ('baixa',        3, 0.2500,  1, 'Giro baixo (sintético).'),
    ('parado',       4, 0.1000,  0, 'Sem vendas em todo o período (sintético).'),
    ('interrompido', 5, 0.0500,  4, 'Vende normalmente e para nos últimos N meses (sintético).')
ON CONFLICT (perfil) DO NOTHING;

-- Dia da semana (ISO). Domingo fechado na simulação.
INSERT INTO config_demo.fator_dia_semana (dia_semana, nome, multiplicador) VALUES
    (1, 'segunda-feira', 0.80), (2, 'terça-feira', 0.90), (3, 'quarta-feira', 0.90),
    (4, 'quinta-feira', 1.00), (5, 'sexta-feira', 1.20), (6, 'sábado', 1.40), (7, 'domingo', 0.00)
ON CONFLICT (dia_semana) DO NOTHING;

-- Datas comerciais — PADRÃO SINTÉTICO INSERIDO (multiplicadores não são observações reais).
INSERT INTO config_demo.data_comercial (data_comercial, regra_calendario, dias_janela, multiplicador) VALUES
    ('Dia das Mães',      'Segundo domingo de maio',                              7, 2.50),
    ('Dia dos Namorados', '12 de junho',                                           5, 1.80),
    ('Black Friday',      'Sexta-feira seguinte à quarta quinta-feira de novembro', 3, 2.00),
    ('Natal',             '25 de dezembro',                                       24, 2.50)
ON CONFLICT (data_comercial) DO NOTHING;

-- Afinidades — PADRÃO SINTÉTICO INSERIDO.
INSERT INTO config_demo.afinidade_tipo (tipo_origem, tipo_destino, peso) VALUES
    ('Anel', 'Brinco', 3), ('Brinco', 'Anel', 2), ('Brinco', 'Colar', 1),
    ('Corrente', 'Pingente', 3), ('Pingente', 'Corrente', 3), ('Cordão', 'Pingente', 2),
    ('Colar', 'Brinco', 2), ('Pulseira', 'Anel', 1), ('Aliança', 'Aliança', 1)
ON CONFLICT (tipo_origem, tipo_destino) DO NOTHING;
