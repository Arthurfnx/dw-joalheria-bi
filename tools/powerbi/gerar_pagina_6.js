// Gera a página 6 (Sazonalidade e Associação de Produtos) do relatorio_joalheria_demo
// Uso: node gerar_pagina_6.js <pasta-.Report>
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./pbir_lib');
const { C, str, num, bool, color, measure, column, DIM_DATA, DIM_PROD, Page } = L;

const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) { console.error('Uso: node gerar_pagina_6.js <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.'); process.exit(1); }

const MOVIMENTACOES = 'e5a7c9e1f3b5d7f9a005';
const P6 = 'f6b8d0a2c4e6f8a0b006';
const AP = 'bi_demo vw_associacao_produtos';
const AT = 'bi_demo vw_associacao_tipos';
const SECAO = '#8C6D3F'; // dourado escuro para rótulos de seção (contraste sobre o creme)

const p = new Page(P6, 'Sazonalidade e Associação', 'f6b8d0a2c4e6');
p.header('Sazonalidade e Associação de Produtos',
  'Datas comerciais e afinidades entre peças · padrões inseridos pelo gerador sintético', 1016);
p.standardSlicers();

const secao = (y, texto) => p.textbox(p.pos(32, y, 1856, 24), [L.para(texto, { fontFamily: 'Segoe UI Semibold', fontSize: '10pt', color: SECAO })], L.noChrome());

const tabela = (position, projections, sortField, title, subtitle, alt, fontSize) => p.add(position, {
  visualType: 'tableEx',
  query: {
    queryState: { Values: { projections } },
    sortDefinition: { sort: [{ field: sortField, direction: 'Descending' }], isDefaultSort: true }
  },
  objects: {
    columnHeaders: [{ properties: {
      columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true),
      backColor: color(C.page), fontColor: color(C.text), bold: bool(true), fontSize: num(fontSize || 9)
    } }],
    values: [{ properties: {
      backColorPrimary: color(C.white), backColorSecondary: color(C.band),
      fontColorPrimary: color(C.text), fontColorSecondary: color(C.text), fontSize: num(fontSize || 9)
    } }],
    total: [{ properties: { totals: bool(false) } }]
  },
  visualContainerObjects: Object.assign(L.chartChrome(title, subtitle, alt), { stylePreset: [{ properties: { name: str('None') } }] })
});

// ===================== SEÇÃO 1 — SAZONALIDADE =====================
secao(184, 'SAZONALIDADE E DATAS COMERCIAIS  ·  responde aos filtros de Ano, Período, Material e Tipo de peça  ·  os efeitos das datas comerciais foram simulados artificialmente');

// 1. Evolução mensal da receita
p.add(p.pos(32, 216, 600, 248), {
  visualType: 'lineChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_DATA, 'ano_mes', { displayName: 'Mês' })] },
      Y: { projections: [measure('Receita Realizada', 'Receita realizada')] }
    },
    sortDefinition: { sort: [{ field: column(DIM_DATA, 'ano_mes').field, direction: 'Ascending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [{ properties: { defaultColor: color(C.graphite) } }],
    lineStyles: [{ properties: { strokeWidth: num(3), lineChartType: str('linear'), areaShow: bool(true), areaMatchStrokeColor: bool(true), showMarker: bool(true), markerSize: num(4), markerColor: color(C.gold) } }],
    labels: [{ properties: { show: bool(false) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(false), preferredCategoryWidth: num(14) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(false), labelDisplayUnits: str('1000'), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: L.chartChrome('Receita realizada por mês', 'R$ (milhares) · eixo no formato ano-mês',
    'Linha com a receita realizada mensal no período filtrado.')
});

// 5. Distribuição mensal por material (colunas empilhadas)
p.add(p.pos(656, 216, 600, 248), {
  visualType: 'columnChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_DATA, 'ano_mes', { displayName: 'Mês' })] },
      Series: { projections: [column(DIM_PROD, 'material', { displayName: 'Material' })] },
      Y: { projections: [measure('Receita Realizada', 'Receita realizada')] }
    },
    sortDefinition: { sort: [{ field: column(DIM_DATA, 'ano_mes').field, direction: 'Ascending' }], isDefaultSort: true }
  },
  objects: {
    labels: [{ properties: { show: bool(false) } }],
    legend: [{ properties: { show: bool(true), position: str('Top'), fontSize: num(9), labelColor: color(C.text2) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(false), preferredCategoryWidth: num(14) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(false), labelDisplayUnits: str('1000'), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: L.chartChrome('Receita mensal por material', 'R$ (milhares) · composição de Ouro, Prata e Folheado em cada mês',
    'Colunas empilhadas com a receita realizada mensal dividida por material.')
});

// 6. Tabela das janelas comerciais
tabela(p.pos(1280, 216, 608, 248), [
  column(DIM_DATA, 'janela_comercial', { displayName: 'Janela comercial' }),
  column(DIM_DATA, 'ano', { displayName: 'Ano' }),
  measure('Dias em Janelas Comerciais', 'Dias'),
  measure('Receita em Janelas Comerciais', 'Receita'),
  measure('Quantidade em Janelas Comerciais', 'Peças'),
  measure('Receita Média Diária - Janelas Comerciais', 'Receita/dia')
], measure('Receita em Janelas Comerciais').field, 'Janelas comerciais por ano',
  'Cada janela inclui os dias que antecedem a data comercial e a própria data',
  'Tabela com cada janela comercial por ano: dias, receita, peças vendidas e receita média por dia.', 8);

// 2. Receita por janela comercial
p.singleSeries('barChart', p.pos(32, 488, 600, 200), column(DIM_DATA, 'janela_comercial', { displayName: 'Janela comercial' }),
  measure('Receita em Janelas Comerciais', 'Receita'), {
    color: C.graphite, labelPos: 'OutsideEnd', catFont: 10,
    title: 'Receita por janela comercial', subtitle: 'R$ · soma dos anos no período filtrado',
    alt: 'Barras horizontais com a receita realizada em cada janela comercial.'
  });
// 3. Quantidade por janela comercial
p.singleSeries('barChart', p.pos(656, 488, 600, 200), column(DIM_DATA, 'janela_comercial', { displayName: 'Janela comercial' }),
  measure('Quantidade em Janelas Comerciais', 'Peças'), {
    color: C.gold, labelPos: 'OutsideEnd', catFont: 10,
    title: 'Peças vendidas por janela comercial', subtitle: 'Peças · soma dos anos no período filtrado',
    alt: 'Barras horizontais com a quantidade de peças vendidas em cada janela comercial.'
  });

// 4. Comparação: receita média diária em janelas × demais datas
p.add(p.pos(1280, 488, 608, 200), {
  visualType: 'cardVisual',
  query: { queryState: { Data: { projections: [
    measure('Receita Média Diária - Janelas Comerciais', 'Em janelas comerciais'),
    measure('Receita Média Diária - Demais Datas', 'Nas demais datas'),
    measure('Diferença da Média Diária - Janelas vs Demais', 'Diferença')
  ] } } },
  objects: {
    value: [{ properties: { fontSize: num(20), fontColor: color(C.text), bold: bool(true), labelDisplayUnits: str('1') }, selector: { id: 'default' } }],
    label: [{ properties: { show: bool(true), fontSize: num(11), fontColor: color(C.text2), position: str('aboveValue') }, selector: { id: 'default' } }],
    padding: [{ properties: { paddingUniform: num(8) }, selector: { id: 'default' } }],
    outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
    layout: [{ properties: {
      paddingUniform: num(0), style: str('Table'), customizeLines: bool(true),
      gridlineWidth: num(1), gridlineColor: color(C.border), gridlineTransparency: num(0), gridlineStyle: str('solid')
    }, selector: { id: 'default' } }],
    accentBar: [{ properties: { show: bool(true), position: str('Top'), width: num(3), color: color(C.gold) }, selector: { id: 'default' } }]
  },
  visualContainerObjects: {
    title: [{ properties: { show: bool(true), text: str('Receita média por dia: janelas × demais datas'), fontFamily: str('Segoe UI Semibold'), fontSize: num(13), fontColor: color(C.text), alignment: str('left') } }],
    subTitle: [{ properties: { show: bool(true), text: str('Média por dia do calendário, para comparar períodos de durações diferentes'), fontFamily: str('Segoe UI'), fontSize: num(10), fontColor: color(C.text2), alignment: str('left') } }],
    padding: [{ properties: { top: num(12), bottom: num(12), left: num(16), right: num(16) }, selector: { id: 'default' } }],
    spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
    general: [{ properties: { altText: str('Receita média por dia nas janelas comerciais, nas demais datas e a diferença percentual entre elas.') } }]
  }
});

// ===================== SEÇÃO 2 — ASSOCIAÇÃO =====================
secao(704, 'ASSOCIAÇÃO DE PRODUTOS E TIPOS DE PEÇA  ·  histórico completo jan/2024–dez/2025: NÃO responde aos filtros desta página  ·  afinidades inseridas pelo gerador sintético, não são padrões descobertos na empresa');

// 1. Ranking Top 10 por lift (mínimo de 5 vendas conjuntas)
tabela(p.pos(32, 736, 400, 312), [
  column(AP, 'codigo_antecedente', { displayName: 'Antecedente' }),
  column(AP, 'codigo_consequente', { displayName: 'Consequente' }),
  measure('Lift - Top 10 Regras de Produtos', 'Lift')
], measure('Lift - Top 10 Regras de Produtos').field, 'Top 10 regras de produtos por lift',
  'Mín. 5 vendas conjuntas · pares nos dois sentidos',
  'Tabela com as dez regras de associação entre produtos de maior lift, entre as que têm pelo menos cinco vendas conjuntas.');

// 2. Tabela detalhada das regras de produtos
tabela(p.pos(456, 736, 640, 312), [
  column(AP, 'codigo_antecedente', { displayName: 'Antecedente' }),
  column(AP, 'material_antecedente', { displayName: 'Mat. antec.' }),
  column(AP, 'codigo_consequente', { displayName: 'Consequente' }),
  column(AP, 'material_consequente', { displayName: 'Mat. conseq.' }),
  measure('Suporte (Regra de Produtos)', 'Suporte'),
  measure('Confiança (Regra de Produtos)', 'Confiança'),
  measure('Lift (Regra de Produtos)', 'Lift')
], measure('Lift (Regra de Produtos)').field, 'Regras de associação entre produtos',
  'Todas as 3.396 regras · valores da própria regra, sem soma entre linhas',
  'Tabela com todas as regras de associação entre produtos: antecedente, consequente, materiais, suporte, confiança e lift.', 8);

// 3. Associação entre tipos de peça
tabela(p.pos(1120, 736, 400, 312), [
  column(AT, 'antecedente', { displayName: 'Antecedente' }),
  column(AT, 'consequente', { displayName: 'Consequente' }),
  measure('Suporte (Regra de Tipos)', 'Suporte'),
  measure('Confiança (Regra de Tipos)', 'Confiança'),
  measure('Lift (Regra de Tipos)', 'Lift')
], measure('Lift (Regra de Tipos)').field, 'Associação entre tipos de peça',
  '90 regras · lift > 1 indica compra conjunta acima do acaso',
  'Tabela com as regras de associação entre tipos de peça: suporte, confiança e lift.');

// 4. Suporte × confiança (tamanho = lift), regras entre tipos
p.add(p.pos(1544, 736, 344, 312), {
  visualType: 'scatterChart',
  query: { queryState: {
    Category: { projections: [column(AT, 'antecedente', { displayName: 'Antecedente' })] },
    Series: { projections: [column(AT, 'consequente', { displayName: 'Consequente' })] },
    X: { projections: [measure('Suporte (Regra de Tipos)', 'Suporte')] },
    Y: { projections: [measure('Confiança (Regra de Tipos)', 'Confiança')] },
    Size: { projections: [measure('Lift (Regra de Tipos)', 'Lift')] }
  } },
  objects: {
    legend: [{ properties: { show: bool(false) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(true), titleText: str('Suporte'), titleFontSize: num(9), gridlineShow: bool(false) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(true), titleText: str('Confiança'), titleFontSize: num(9), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: L.chartChrome('Suporte × confiança (tipos)', 'Cada bolha é uma regra · tamanho = lift',
    'Gráfico de dispersão das regras entre tipos de peça: suporte no eixo horizontal, confiança no vertical e lift no tamanho da bolha.')
});

p.write(REPORT);
const file = path.join(REPORT, 'definition', 'pages', 'pages.json');
const pages = JSON.parse(fs.readFileSync(file, 'utf8'));
const rest = pages.pageOrder.filter((x) => x !== P6);
const i = rest.indexOf(MOVIMENTACOES);
pages.pageOrder = i >= 0 ? [...rest.slice(0, i + 1), P6, ...rest.slice(i + 1)] : [...rest, P6];
L.writeJson(file, pages);
console.log(JSON.stringify({ pagina: p.displayName, id: P6, visuais: p.visuals.length, ordem: pages.pageOrder, ativa: pages.activePageName }));
