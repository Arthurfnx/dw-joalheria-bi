// Gera os dois painéis a partir das consultas:
//   painel_nobreza.json          ← consultas/*.sql (público, sem variáveis: o link público não as aceita);
//   painel_nobreza_completo.json ← consultas_completo/*.sql (com login; filtros Material, Tipo de peça e Ano).
// As consultas são a fonte: depois de alterar um .sql, rode
//   node tools/grafana/gerar_painel.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
// Variante em geração: o painel público (sem variáveis) ou o completo (com filtros, para uso com login).
let variante = { pasta: 'consultas', completo: false };
const sql = (nome) => readFileSync(join(pasta, variante.pasta, nome), 'utf8').trim();

// No painel completo, cada descrição diz quais filtros valem para aquele painel.
const NOTA_VENDAS = 'Filtros: Material, Tipo de peça e Ano da venda (com "Todos" em Ano, todo o período).';
const NOTAS = {
  '01': NOTA_VENDAS, '02': NOTA_VENDAS, '03': NOTA_VENDAS, '04': NOTA_VENDAS, '05': NOTA_VENDAS,
  '06': NOTA_VENDAS, '12': NOTA_VENDAS, '13': NOTA_VENDAS,
  '07': 'Filtros: Material e Tipo de peça. Ano filtra só as vendas; o estoque é sempre o de hoje.',
  '08': 'Filtros: Material e Tipo de peça. Ano filtra só as vendas; o estoque é sempre o de hoje.',
  '09': 'Filtros: Material e Tipo de peça. Ano não se aplica: é o estoque de hoje.',
  '10': 'Filtros: Material e Tipo de peça. Ano não se aplica: é o estoque de hoje.',
  '11': 'Filtros: Material e Tipo de peça. Ano não se aplica: é o estoque de hoje.',
  '14': 'Filtros: Material e Tipo de peça. Ano não se aplica: a regra usa sempre os últimos 12 meses.',
};
const nota = (descricao, arquivo) => {
  const n = variante.completo ? NOTAS[arquivo.slice(0, 2)] : undefined;
  return n ? `${descricao} ${n}` : descricao;
};
const DS = { type: 'grafana-postgresql-datasource', uid: '${DS_NOBREZA}' };
const COR_RS = 'semi-dark-yellow';
const COR_PECAS = 'blue';

let proximoId = 1;
const alvo = (arquivo) => [{ refId: 'A', datasource: DS, editorMode: 'code', format: 'table', rawQuery: true, rawSql: sql(arquivo) }];

function linha(titulo, y) {
  return { id: proximoId++, type: 'row', title: titulo, collapsed: false, panels: [], gridPos: { h: 1, w: 24, x: 0, y } };
}

function texto(titulo, conteudo, gridPos) {
  return { id: proximoId++, type: 'text', title: titulo, gridPos, options: { mode: 'markdown', content: conteudo } };
}

function cartoes(titulo, descricao, arquivo, gridPos) {
  return {
    id: proximoId++, type: 'stat', title: titulo, description: nota(descricao, arquivo), datasource: DS, gridPos,
    targets: alvo(arquivo),
    fieldConfig: {
      defaults: { unit: 'locale', decimals: 0, color: { mode: 'fixed', fixedColor: 'text' }, thresholds: { mode: 'absolute', steps: [{ color: 'text', value: null }] }, mappings: [] },
      overrides: [],
    },
    options: {
      reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/.*/' },
      orientation: 'vertical', textMode: 'value_and_name', colorMode: 'none', graphMode: 'none',
      justifyMode: 'center', wideLayout: true, showPercentChange: false,
    },
  };
}

function barras(titulo, descricao, arquivo, gridPos, { campoX, cor, decimais, horizontal = false }) {
  return {
    id: proximoId++, type: 'barchart', title: titulo, description: nota(descricao, arquivo), datasource: DS, gridPos,
    targets: alvo(arquivo),
    fieldConfig: {
      defaults: {
        // "locale" usa o idioma do navegador: em pt-BR, vírgula decimal e ponto de milhar.
        unit: 'locale', decimals: decimais, min: 0,
        color: { mode: 'fixed', fixedColor: cor },
        thresholds: { mode: 'absolute', steps: [{ color: cor, value: null }] },
        custom: { fillOpacity: 85, lineWidth: 0, gradientMode: 'none', axisPlacement: 'auto', axisLabel: '', axisCenteredZero: false, axisSoftMin: 0, hideFrom: { legend: false, tooltip: false, viz: false }, scaleDistribution: { type: 'linear' }, thresholdsStyle: { mode: 'off' } },
        mappings: [],
      },
      overrides: [],
    },
    options: {
      xField: campoX, orientation: horizontal ? 'horizontal' : 'vertical', showValue: 'auto', stacking: 'none',
      groupWidth: 0.7, barWidth: 0.85, barRadius: 0, fullHighlight: false,
      xTickLabelRotation: horizontal ? 0 : -45, xTickLabelSpacing: 0,
      legend: { showLegend: false, displayMode: 'list', placement: 'bottom', calcs: [] },
      tooltip: { mode: 'single', sort: 'none' },
    },
  };
}

function tabela(titulo, descricao, arquivo, gridPos, { somar = [], overrides = [] } = {}) {
  return {
    id: proximoId++, type: 'table', title: titulo, description: nota(descricao, arquivo), datasource: DS, gridPos,
    targets: alvo(arquivo),
    fieldConfig: {
      defaults: {
        unit: 'locale', decimals: 0,
        custom: { align: 'auto', cellOptions: { type: 'auto' }, inspect: false, filterable: false },
        color: { mode: 'thresholds' },
        thresholds: { mode: 'absolute', steps: [{ color: 'transparent', value: null }] },
        mappings: [],
      },
      overrides,
    },
    options: {
      showHeader: true, cellHeight: 'sm',
      footer: somar.length
        ? { show: true, reducer: ['sum'], fields: somar, countRows: false, enablePagination: false }
        : { show: false, reducer: ['sum'], fields: '', countRows: false },
    },
  };
}

function gerar(v) {
variante = v;
proximoId = 1;

const cabecalho = [
  '**Nobreza Jóias — indicadores de vendas e estoque.** Fonte: Data Warehouse PostgreSQL (esquema `bi`), alimentado pelo sistema de gestão da loja.',
  '',
  'Vendas anteriores ao sistema vêm da planilha da loja, **sem número de venda**: ticket médio e associação entre produtos não são calculados com elas. ',
  'Receita = valor faturado (sem vendas simbólicas de R$ 0,01 nem vendas sem valor, que contam como peças vendidas). Vendas canceladas não entram. ',
  'Valores em R$; estoque e vendas em peças. "Hoje" = data de referência da última carga (cartão ao lado).',
  ...(v.completo ? ['', '**Filtros no topo:** Material e Tipo de peça valem para todos os painéis; Ano filtra as vendas. Em parados e reposição o ano não se aplica (estoque de hoje e últimos 12 meses).'] : []),
].join('\n');

const painel = [];
let y = 0;
painel.push(texto('Sobre este painel', cabecalho, { h: 5, w: 16, x: 0, y }));
painel.push(cartoes('Atualização dos dados', 'Data de referência da última carga do DW (dia do último retrato do estoque) e status da carga. Todos os cálculos de "hoje" usam essa data.', '00_info_carga.sql', { h: 5, w: 8, x: 16, y }));
y += 5;

painel.push(linha('1. Vendas por período', y++));
painel.push(cartoes('Totais do período', 'Receita faturada = Σ valor faturado (R$). Peças vendidas = Σ quantidade vendida, inclusive vendas simbólicas e sem valor, que aparecem em "Peças vendidas sem receita". Período: todas as vendas registradas.', '01_vendas_totais.sql', { h: 4, w: 24, x: 0, y }));
y += 4;
painel.push(barras('Receita faturada por mês (R$)', 'Σ valor faturado por mês da venda, em R$. Meses sem venda aparecem com zero. Vendas simbólicas (R$ 0,01) e sem valor ficam fora da receita.', '02_vendas_receita_mes.sql', { h: 9, w: 12, x: 0, y }, { campoX: 'Mês', cor: COR_RS, decimais: 2 }));
painel.push(barras('Peças vendidas por mês', 'Σ quantidade vendida por mês da venda, em peças (inclui vendas simbólicas e sem valor). Meses sem venda aparecem com zero.', '03_vendas_pecas_mes.sql', { h: 9, w: 12, x: 12, y }, { campoX: 'Mês', cor: COR_PECAS, decimais: 0 }));
y += 9;

painel.push(linha('2. Tipos de produto vendidos', y++));
painel.push(barras('Peças vendidas por tipo de peça', 'Σ quantidade vendida por tipo de peça, em peças. Período completo.', '04_tipos_pecas.sql', { h: 9, w: 8, x: 0, y }, { campoX: 'Tipo de peça', cor: COR_PECAS, decimais: 0, horizontal: true }));
painel.push(barras('Receita por tipo de peça (R$)', 'Σ valor faturado por tipo de peça, em R$. Período completo. Um tipo pode ter peças vendidas e receita zero quando as vendas foram simbólicas ou sem valor.', '05_tipos_receita.sql', { h: 9, w: 8, x: 8, y }, { campoX: 'Tipo de peça', cor: COR_RS, decimais: 2, horizontal: true }));
painel.push(tabela('Vendas por material', 'Peças vendidas (Σ quantidade), receita faturada (Σ valor faturado, R$) e participação de cada material nas peças vendidas. Período completo.', '06_materiais_vendidos.sql', { h: 9, w: 8, x: 16, y }, { somar: ['Peças vendidas'] }));
y += 9;

const descTaxa = (por) => `Por ${por}. **Taxa de venda** = peças vendidas ÷ (peças vendidas + peças em estoque hoje). **Tempo até a venda** = dias entre a data de aquisição e a data da venda, só nas vendas cujo produto tem data de aquisição (a coluna "Amostra" mostra quantas); vendas com aquisição posterior à venda ficam fora. Cada peça do cadastro é única, por isso a medida é por ${por} e não por produto. Não é o giro de estoque tradicional, que exige custo das vendas e estoque médio valorizado.`;
painel.push(linha('3. Taxa de venda e tempo até a venda', y++));
painel.push(tabela('Taxa de venda e tempo até a venda — por tipo de peça', descTaxa('tipo de peça'), '07_taxa_venda_tipo.sql', { h: 11, w: 14, x: 0, y }, { somar: ['Peças vendidas', 'Em estoque hoje', 'Amostra (vendas com data)'] }));
painel.push(tabela('Taxa de venda e tempo até a venda — por material', descTaxa('material'), '08_taxa_venda_material.sql', { h: 11, w: 10, x: 14, y }, { somar: ['Peças vendidas', 'Em estoque hoje', 'Amostra (vendas com data)'] }));
y += 11;

painel.push(linha('4. Produtos parados (mais antigos primeiro)', y++));
painel.push(tabela('Produtos parados — Material › Tipo de peça › Produto', 'Peças em estoque hoje (último retrato diário) com data de aquisição informada. **Dias parado** = data de referência da carga − data de aquisição, do maior para o menor. As peças sem data de aquisição estão no painel ao lado; nenhuma data é estimada.', '09_parados_com_data.sql', { h: 16, w: 16, x: 0, y }, {
  somar: ['Peças'],
  overrides: [{ matcher: { id: 'byName', options: 'Produto' }, properties: [{ id: 'custom.minWidth', value: 220 }] }],
}));
painel.push(tabela('Em estoque — data de aquisição não informada', 'Peças em estoque hoje sem data de aquisição no cadastro, por material e tipo de peça (inclui todo o ouro). Sem a data não há como calcular dias parado; nenhuma data é estimada.', '10_parados_sem_data.sql', { h: 16, w: 8, x: 16, y }, { somar: ['Peças'] }));
y += 16;

painel.push(linha('5. Tipo de peça que mais fica parado', y++));
painel.push(tabela('Dias parado por tipo de peça', 'Só peças em estoque hoje com data de aquisição. Dias parado = data de referência da carga − data de aquisição. Mediana e média por tipo de peça e % de peças com mais de 180 dias. Ordem: do tipo mais parado (maior mediana) para o menos parado. "Sem data" mostra as peças do tipo que ficaram fora do cálculo.', '11_tipo_mais_parado.sql', { h: 9, w: 24, x: 0, y }, { somar: ['Peças com data', 'Sem data (fora do cálculo)'] }));
y += 9;

const descSaz = (v.completo ? 'Somando os anos escolhidos.' : 'Somando todos os anos.') + ' Há cerca de 110 vendas em dois anos de histórico e alguns meses aparecem em mais de um ano: o padrão é só indicativo.';
painel.push(linha('6. Sazonalidade (mês do ano)', y++));
painel.push(barras('Peças vendidas por mês do ano', `Σ quantidade vendida por mês do ano (jan a dez), em peças. ${descSaz}`, '12_sazonalidade_pecas.sql', { h: 8, w: 12, x: 0, y }, { campoX: 'Mês', cor: COR_PECAS, decimais: 0 }));
painel.push(barras('Receita faturada por mês do ano (R$)', `Σ valor faturado por mês do ano (jan a dez), em R$. ${descSaz}`, '13_sazonalidade_receita.sql', { h: 8, w: 12, x: 12, y }, { campoX: 'Mês', cor: COR_RS, decimais: 2 }));
y += 8;

painel.push(linha('7. Reposição — proposta (a confirmar com o proprietário)', y++));
painel.push(tabela('Cobertura do estoque por material e tipo de peça — proposta (a confirmar com o proprietário)', 'Regra proposta, a confirmar com o proprietário. **Cobertura (meses)** = estoque atual ÷ (peças vendidas nos últimos 12 meses ÷ 12). Abaixo de 3 meses aparece em vermelho como "Repor". Sem vendas nos 12 meses anteriores à data de referência, a cobertura fica indefinida (—). O material entra na quebra porque o ouro não tem venda registrada e misturá-lo ao folheado do mesmo tipo distorceria a cobertura. Ordem: menor cobertura primeiro.', '14_reposicao.sql', { h: 13, w: 24, x: 0, y }, {
  somar: ['Estoque atual', 'Vendidas em 12 meses'],
  overrides: [{
    matcher: { id: 'byName', options: 'Situação (proposta)' },
    properties: [
      { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'basic' } },
      { id: 'mappings', value: [{ type: 'value', options: {
        'Repor (abaixo de 3 meses)': { color: 'red', index: 0 },
        'Sem vendas em 12 meses': { color: 'transparent', index: 1 },
        'Cobertura de 3 meses ou mais': { color: 'transparent', index: 2 },
      } }] },
    ],
  }],
}));
y += 13;

const json = {
  __inputs: [{ name: 'DS_NOBREZA', label: 'Nobreza DW (PostgreSQL)', description: 'Fonte PostgreSQL do DW dw_joalheria com o usuário bi_leitura', type: 'datasource', pluginId: 'grafana-postgresql-datasource', pluginName: 'PostgreSQL' }],
  __elements: {},
  __requires: [
    { type: 'grafana', id: 'grafana', name: 'Grafana', version: '10.4.0' },
    { type: 'datasource', id: 'grafana-postgresql-datasource', name: 'PostgreSQL', version: '1.0.0' },
    { type: 'panel', id: 'barchart', name: 'Bar chart', version: '' },
    { type: 'panel', id: 'stat', name: 'Stat', version: '' },
    { type: 'panel', id: 'table', name: 'Table', version: '' },
    { type: 'panel', id: 'text', name: 'Text', version: '' },
  ],
  annotations: { list: [] },
  description: v.descricao,
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 0,
  links: [],
  panels: painel,
  refresh: '',
  schemaVersion: 39,
  tags: ['nobreza', 'joalheria'],
  // Variáveis só no painel completo: o link público do Grafana não aceita variáveis.
  ...(v.completo ? { templating: { list: variaveis() } } : {}),
  // As consultas não usam o intervalo de tempo do painel: cada uma cobre o período descrito.
  time: { from: 'now-3y', to: 'now' },
  timepicker: { hidden: true },
  timezone: 'browser',
  title: v.titulo,
  uid: v.uid,
  version: 1,
  weekStart: '',
};

writeFileSync(join(pasta, v.arquivo), JSON.stringify(json, null, 2) + '\n', 'utf8');
console.log(`${v.arquivo} gerado: ${painel.length} painéis (incluindo linhas e texto).`);
}

// Variáveis de seleção múltipla com "Todos". Sem allValue: com "Todos", o Grafana expande a
// variável para a lista de todos os valores entre aspas simples ('a','b'), o que mantém
// válido o filtro "coluna IN ($variavel)" nas consultas.
function variavel(nome, rotulo, consulta) {
  return {
    type: 'query', name: nome, label: rotulo, datasource: DS,
    query: consulta, definition: consulta,
    refresh: 1, multi: true, includeAll: true, allValue: null,
    current: { selected: true, text: ['All'], value: ['$__all'] },
    options: [], regex: '', sort: 0, hide: 0, skipUrlSync: false,
  };
}

function variaveis() {
  return [
    variavel('material', 'Material', 'SELECT DISTINCT material FROM bi.vw_dim_produto ORDER BY 1'),
    variavel('tipo_peca', 'Tipo de peça', 'SELECT DISTINCT tipo_peca FROM bi.vw_dim_produto WHERE material IN ($material) ORDER BY 1'),
    variavel('ano', 'Ano', 'SELECT DISTINCT d.ano::text FROM bi.vw_dim_data d JOIN bi.vw_fato_venda_item v ON v.data_key = d.data_key ORDER BY 1'),
  ];
}

gerar({
  pasta: 'consultas', completo: false, arquivo: 'painel_nobreza.json',
  titulo: 'Nobreza Jóias — Indicadores', uid: 'nobreza-indicadores',
  descricao: 'Indicadores de vendas e estoque da Nobreza Jóias a partir do DW PostgreSQL (esquema bi).',
});
gerar({
  pasta: 'consultas_completo', completo: true, arquivo: 'painel_nobreza_completo.json',
  titulo: 'Nobreza Jóias — Indicadores (completo)', uid: 'nobreza-indicadores-completo',
  descricao: 'Indicadores de vendas e estoque da Nobreza Jóias, com filtros de material, tipo de peça e ano (uso com login).',
});
