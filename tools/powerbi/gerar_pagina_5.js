// Gera a página 5 (Movimentações de Estoque) do relatorio_joalheria_demo
// Uso: node gerar_pagina_5.js <pasta-.Report>
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./pbir_lib');
const { C, str, num, bool, color, measure, column, DIM_DATA, DIM_PROD, Page } = L;

const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) { console.error('Uso: node gerar_pagina_5.js <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.'); process.exit(1); }

const COMPRAS = 'd4f6a8c0e2b4d6f8a004';
const P5 = 'e5a7c9e1f3b5d7f9a005';
const FATO_MOV = 'bi_demo vw_fato_movimentacao_estoque';
const DIM_TIPO = 'bi_demo vw_dim_tipo_movimentacao';
const ENTRADA = C.gold;
const SAIDA = C.graphite;

const p = new Page(P5, 'Movimentações de Estoque', 'e5a7c9e1f3b5');
p.header('Movimentações de Estoque — entradas, saídas e saldo',
  'Sinal definido pelo tipo de movimentação · presentes e ajustes não são receita', 808);

// Filtros: Ano, Período, Material, Tipo de peça, Tipo de movimentação
p.slicer(p.pos(864, 64, 144, 104), column(DIM_DATA, 'ano'), 'Ano', 'Dropdown');
p.slicer(p.pos(1032, 64, 216, 104), column(DIM_DATA, 'data'), 'Período', 'Between');
p.slicer(p.pos(1272, 64, 168, 104), column(DIM_PROD, 'material'), 'Material', 'Dropdown');
p.slicer(p.pos(1464, 64, 184, 104), column(DIM_PROD, 'tipo_peca'), 'Tipo de peça', 'Dropdown');
p.slicer(p.pos(1672, 64, 216, 104), column(DIM_TIPO, 'descricao_tipo'), 'Tipo de movimentação', 'Dropdown');

p.kpiStrip(p.pos(32, 192, 1856, 104), [
  measure('Entradas por Compra (Peças)', 'Recebidas por compra'),
  measure('Saídas por Venda (Peças)', 'Vendidas'),
  measure('Saídas por Presente (Peças)', 'Presentes'),
  measure('Ajustes Positivos (Peças)', 'Ajustes positivos'),
  measure('Ajustes Negativos (Peças)', 'Ajustes negativos'),
  measure('Estoque Atual (Peças)', 'Estoque atual')
], 'Indicadores em peças: recebidas por compra, vendidas, presentes, ajustes positivos, ajustes negativos e estoque atual na posição mais recente.', '1', '0');

// 1. Evolução mensal das entradas (+) e saídas (−) por tipo — colunas empilhadas com sinal
p.add(p.pos(32, 320, 896, 352), {
  visualType: 'columnChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_DATA, 'ano_mes', { displayName: 'Mês' })] },
      Series: { projections: [column(DIM_TIPO, 'descricao_tipo', { displayName: 'Tipo de movimentação' })] },
      Y: { projections: [measure('Saldo Líquido Movimentado', 'Peças (com sinal)')] }
    },
    sortDefinition: { sort: [{ field: column(DIM_DATA, 'ano_mes').field, direction: 'Ascending' }], isDefaultSort: true }
  },
  objects: {
    labels: [{ properties: { show: bool(false) } }],
    legend: [{ properties: { show: bool(true), position: str('Top'), fontSize: num(9), labelColor: color(C.text2) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(10), labelColor: color(C.text), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(10), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: L.chartChrome('Entradas e saídas por mês e tipo',
    'Peças · entradas acima de zero, saídas abaixo · jan/2024 inclui a implantação do saldo inicial',
    'Colunas empilhadas mensais com as peças movimentadas por tipo, entradas positivas e saídas negativas.')
});

// 2. Movimentações por tipo: eventos e peças
const eventos = measure('Eventos de Movimentação', 'Eventos');
const pecas = measure('Peças Movimentadas', 'Peças movimentadas');
p.add(p.pos(952, 320, 456, 352), {
  visualType: 'clusteredBarChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_TIPO, 'descricao_tipo', { displayName: 'Tipo de movimentação' })] },
      Y: { projections: [eventos, pecas] }
    },
    sortDefinition: { sort: [{ field: pecas.field, direction: 'Descending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [
      { properties: { fill: color(C.steel) }, selector: { metadata: eventos.queryRef } },
      { properties: { fill: color(C.gold) }, selector: { metadata: pecas.queryRef } }
    ],
    labels: [{ properties: { show: bool(true), fontSize: num(9), color: color(C.text), labelDisplayUnits: str('1'), labelPosition: str('OutsideEnd') } }],
    legend: [{ properties: { show: bool(true), position: str('Top'), fontSize: num(9), labelColor: color(C.text2) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
    valueAxis: [{ properties: { show: bool(false), showAxisTitle: bool(false), gridlineShow: bool(false) } }]
  },
  visualContainerObjects: L.chartChrome('Movimentações por tipo', 'Eventos e peças · saída por roubo prevista, sem eventos na simulação',
    'Barras agrupadas com o número de eventos e as peças movimentadas por tipo de movimentação.')
});

// 6. Distribuição por categoria (natureza)
p.singleSeries('barChart', p.pos(1432, 320, 456, 352), column(DIM_TIPO, 'natureza', { displayName: 'Categoria' }),
  measure('Peças Movimentadas', 'Peças movimentadas'), {
    color: C.steel, catFont: 11, labelPos: 'OutsideEnd', labelUnits: '1',
    tooltips: [measure('Eventos de Movimentação', 'Eventos')],
    title: 'Distribuição por categoria', subtitle: 'Peças movimentadas · implantação, entrada, saída e ajuste',
    alt: 'Barras horizontais com as peças movimentadas por categoria de movimentação.'
  });

// 3. Evolução mensal do saldo (snapshots) com reconciliação no tooltip
p.add(p.pos(32, 696, 656, 352), {
  visualType: 'lineChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_DATA, 'ano_mes', { displayName: 'Mês' })] },
      Y: { projections: [measure('Estoque Atual (Peças)', 'Saldo (snapshot)')] },
      Tooltips: { projections: [measure('Saldo Acumulado por Movimentações', 'Saldo pelas movimentações'), measure('Data da Posição de Estoque', 'Data da posição')] }
    },
    sortDefinition: { sort: [{ field: column(DIM_DATA, 'ano_mes').field, direction: 'Ascending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [{ properties: { defaultColor: color(C.gold) } }],
    lineStyles: [{ properties: { strokeWidth: num(3), lineChartType: str('linear'), areaShow: bool(true), areaMatchStrokeColor: bool(true), showMarker: bool(true), markerSize: num(4), markerColor: color(C.graphite) } }],
    labels: [{ properties: { show: bool(false) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(false), preferredCategoryWidth: num(14) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(10), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: L.chartChrome('Saldo de estoque no fim de cada mês',
    'Peças · snapshot mensal; o tooltip mostra o saldo reconstruído pelas movimentações',
    'Linha com o saldo de estoque em peças no fim de cada mês, a partir dos snapshots.')
});

// 4. Entradas e saídas por material
const ent = measure('Entradas de Estoque (Peças)', 'Entradas');
const sai = measure('Saídas de Estoque (Peças)', 'Saídas');
p.add(p.pos(712, 696, 344, 352), {
  visualType: 'clusteredBarChart',
  query: {
    queryState: {
      Category: { projections: [column(DIM_PROD, 'material', { displayName: 'Material' })] },
      Y: { projections: [ent, sai] }
    },
    sortDefinition: { sort: [{ field: ent.field, direction: 'Descending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [
      { properties: { fill: color(ENTRADA) }, selector: { metadata: ent.queryRef } },
      { properties: { fill: color(SAIDA) }, selector: { metadata: sai.queryRef } }
    ],
    labels: [{ properties: { show: bool(true), fontSize: num(10), color: color(C.text), labelDisplayUnits: str('1'), labelPosition: str('OutsideEnd') } }],
    legend: [{ properties: { show: bool(true), position: str('Top'), fontSize: num(10), labelColor: color(C.text2) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(11), labelColor: color(C.text), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
    valueAxis: [{ properties: { show: bool(false), showAxisTitle: bool(false), gridlineShow: bool(false) } }]
  },
  visualContainerObjects: L.chartChrome('Entradas e saídas por material', 'Entradas: saldo inicial, compras e ajustes +',
    'Barras agrupadas com as peças de entrada e de saída por material.')
});

// 5. Tabela detalhada das movimentações
p.add(p.pos(1080, 696, 808, 352), {
  visualType: 'tableEx',
  query: {
    queryState: { Values: { projections: [
      column(FATO_MOV, 'data_hora_evento', { displayName: 'Data' }),
      column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
      column(DIM_PROD, 'material', { displayName: 'Material' }),
      column(DIM_TIPO, 'descricao_tipo', { displayName: 'Tipo' }),
      measure('Peças Movimentadas', 'Qtd.'),
      column(DIM_TIPO, 'sinal', { displayName: 'Sinal' })
    ] } },
    sortDefinition: { sort: [{ field: column(FATO_MOV, 'data_hora_evento').field, direction: 'Descending' }], isDefaultSort: true }
  },
  objects: {
    columnHeaders: [{ properties: {
      columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true),
      backColor: color(C.page), fontColor: color(C.text), bold: bool(true), fontSize: num(9)
    } }],
    values: [{ properties: {
      backColorPrimary: color(C.white), backColorSecondary: color(C.band),
      fontColorPrimary: color(C.text), fontColorSecondary: color(C.text), fontSize: num(9)
    } }],
    total: [{ properties: { totals: bool(false) } }]
  },
  visualContainerObjects: Object.assign(L.chartChrome('Detalhe das movimentações',
    'Um evento por linha · quantidade sempre positiva; o sinal vem do tipo',
    'Tabela com data, produto, material, tipo de movimentação, quantidade e sinal de cada evento de estoque.'),
    { stylePreset: [{ properties: { name: str('None') } }] })
});

p.write(REPORT);
const file = path.join(REPORT, 'definition', 'pages', 'pages.json');
const pages = JSON.parse(fs.readFileSync(file, 'utf8'));
const rest = pages.pageOrder.filter((x) => x !== P5);
const i = rest.indexOf(COMPRAS);
pages.pageOrder = i >= 0 ? [...rest.slice(0, i + 1), P5, ...rest.slice(i + 1)] : [...rest, P5];
L.writeJson(file, pages);
console.log(JSON.stringify({ pagina: p.displayName, id: P5, visuais: p.visuals.length, ordem: pages.pageOrder, ativa: pages.activePageName }));
