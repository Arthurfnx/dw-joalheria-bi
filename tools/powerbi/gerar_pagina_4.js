// Gera a página 4 (Compras e Custos) do relatorio_joalheria_demo
// Uso: node gerar_pagina_4.js <pasta-.Report>
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./pbir_lib');
const { C, str, num, bool, color, measure, column, DIM_DATA, DIM_PROD, Page } = L;

const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) { console.error('Uso: node gerar_pagina_4.js <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.'); process.exit(1); }

const VENDAS = 'c3e5a7b9d1f2a4c6e803';
const P4 = 'd4f6a8c0e2b4d6f8a004';
const FATO_COMPRA = 'bi_demo vw_fato_compra_item';
const CUSTO = '#4A5560';   // custo de aquisição (R$)
const QTD = C.gold;        // peças adquiridas

const p = new Page(P4, 'Compras e Custos', 'd4f6a8c0e2b4');
p.header('Compras e Custos — investimento em aquisições',
  'Entradas de compra sintéticas · custo médio ponderado de aquisição não é CMV · margem não calculada', 1016);
p.standardSlicers();

p.kpiStrip(p.pos(32, 192, 1856, 104), [
  measure('Custo Total das Compras', 'Custo total das compras'),
  measure('Quantidade Adquirida', 'Quantidade adquirida (peças)'),
  measure('Entradas de Compra', 'Entradas de compra'),
  measure('Custo Médio Ponderado de Aquisição', 'Custo médio ponderado (por peça)')
], 'Indicadores de compras: custo total pago, peças adquiridas, número de entradas de compra e custo médio ponderado de aquisição por peça.', '1');

p.singleSeries('columnChart', p.pos(32, 320, 896, 352), column(DIM_DATA, 'ano_mes', { displayName: 'Mês' }),
  measure('Custo Total das Compras', 'Custo total'), {
    color: CUSTO, sortByCategory: true, labels: false, valueAxis: true, axisUnits: '1000',
    title: 'Custo total das compras por mês', subtitle: 'R$ (milhares) · eixo no formato ano-mês',
    alt: 'Colunas com o custo total das compras em cada mês do período filtrado.'
  });
p.singleSeries('barChart', p.pos(952, 320, 456, 352), column(DIM_PROD, 'material', { displayName: 'Material' }),
  measure('Custo Total das Compras', 'Custo total'), {
    color: CUSTO, catFont: 11, labelPos: 'OutsideEnd',
    title: 'Custo de aquisição por material', subtitle: 'R$ · ordem decrescente',
    alt: 'Barras horizontais com o custo total de aquisição por material.'
  });
p.singleSeries('barChart', p.pos(1432, 320, 456, 352), column(DIM_PROD, 'material', { displayName: 'Material' }),
  measure('Quantidade Adquirida', 'Quantidade adquirida'), {
    color: QTD, catFont: 11, labelPos: 'OutsideEnd',
    title: 'Quantidade adquirida por material', subtitle: 'Peças · ordem decrescente',
    alt: 'Barras horizontais com a quantidade de peças adquiridas por material.'
  });

p.singleSeries('barChart', p.pos(32, 696, 440, 352), column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
  measure('Quantidade Adquirida', 'Quantidade adquirida'), {
    color: QTD, labelPos: 'OutsideEnd',
    title: 'Quantidade adquirida por tipo de peça', subtitle: 'Peças · ordem decrescente',
    alt: 'Barras horizontais com a quantidade de peças adquiridas por tipo de peça.'
  });
p.singleSeries('barChart', p.pos(496, 696, 520, 352), column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
  measure('Custo Total - Top 10 Produtos', 'Custo total'), {
    color: CUSTO, catFont: 9, labelPos: 'OutsideEnd',
    title: 'Top 10 produtos por custo de aquisição', subtitle: 'R$ · dentro dos filtros da página',
    alt: 'Barras horizontais com os dez produtos de maior custo total de aquisição.'
  });

// Tabela detalhada: uma linha por item de entrada (data + produto é único), preservando o histórico de custos
p.add(p.pos(1040, 696, 848, 352), {
  visualType: 'tableEx',
  query: {
    queryState: { Values: { projections: [
      column(FATO_COMPRA, 'data_hora_entrada', { displayName: 'Data de entrada' }),
      column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
      column(DIM_PROD, 'material', { displayName: 'Material' }),
      column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
      measure('Quantidade Adquirida', 'Qtd.'),
      measure('Custo Médio Ponderado de Aquisição', 'Custo unitário'),
      measure('Custo Total das Compras', 'Custo total')
    ] } },
    sortDefinition: { sort: [{ field: column(FATO_COMPRA, 'data_hora_entrada').field, direction: 'Descending' }], isDefaultSort: true }
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
  visualContainerObjects: Object.assign(L.chartChrome('Detalhe das entradas de compra',
    'Uma linha por item de entrada · custo unitário = custo total ÷ quantidade da própria linha',
    'Tabela com data de entrada, produto, material, tipo de peça, quantidade, custo unitário e custo total de cada item de compra.'),
    { stylePreset: [{ properties: { name: str('None') } }] })
});

p.write(REPORT);
// Página 4 logo após Vendas
const file = path.join(REPORT, 'definition', 'pages', 'pages.json');
const pages = JSON.parse(fs.readFileSync(file, 'utf8'));
const rest = pages.pageOrder.filter((x) => x !== P4);
const i = rest.indexOf(VENDAS);
pages.pageOrder = i >= 0 ? [...rest.slice(0, i + 1), P4, ...rest.slice(i + 1)] : [...rest, P4];
L.writeJson(file, pages);
console.log(JSON.stringify({ pagina: p.displayName, id: P4, visuais: p.visuals.length, ordem: pages.pageOrder, ativa: pages.activePageName }));
