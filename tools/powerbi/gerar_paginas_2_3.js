// Gera as páginas 2 (Estoque e Produtos) e 3 (Vendas) do relatorio_joalheria_demo
// Uso: node gerar_paginas_2_3.js <pasta-.Report> <2|3|todas>
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./pbir_lib');
const { C, str, num, bool, color, measure, column, DIM_DATA, DIM_PROD, Page } = L;

const REPORT = process.argv[2];
const WHICH = process.argv[3] || 'todas';
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json')) || !['2', '3', 'todas'].includes(WHICH)) {
  console.error('Uso: node gerar_paginas_2_3.js <pasta .Report de destino> [2|3|todas]\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.');
  process.exit(1);
}

const VISAO_GERAL = 'a7c3e91f5b2d48e6a0f1';
const P2 = 'b2d4f60a1c3e5a7b9d02';
const P3 = 'c3e5a7b9d1f2a4c6e803';

// ===================== PÁGINA 2 — ESTOQUE E PRODUTOS =====================
function pagina2() {
  const p = new Page(P2, 'Estoque e Produtos', 'b2d4f60a1c3e');
  p.header('Estoque e Produtos — posição e evolução',
    'Saldo na posição mensal mais recente do período filtrado · peças e gramas apresentadas separadamente', 1016);
  p.standardSlicers();

  p.kpiStrip(p.pos(32, 192, 1856, 104), [
    measure('Estoque Atual (Peças)', 'Estoque atual (peças)'),
    measure('Produtos Cadastrados', 'Produtos cadastrados'),
    measure('Produtos sem Estoque', 'Produtos sem estoque'),
    measure('Produtos sem Venda no Período', 'Produtos sem venda no período'),
    measure('Peso em Estoque Ouro (g)', 'Peso em estoque · Ouro (g)')
  ], 'Indicadores de estoque: saldo em peças, produtos cadastrados, produtos sem estoque, produtos com estoque e sem venda no período, e peso das peças de ouro em gramas.');

  p.singleSeries('barChart', p.pos(32, 320, 424, 352), column(DIM_PROD, 'material', { displayName: 'Material' }),
    measure('Estoque Atual (Peças)', 'Estoque (peças)'), {
      color: C.gold, catFont: 11,
      tooltips: [measure('Data da Posição de Estoque', 'Data da posição')],
      title: 'Estoque por material', subtitle: 'Peças na posição mais recente',
      alt: 'Barras horizontais com o estoque em peças por material na posição mais recente do período.'
    });
  p.singleSeries('barChart', p.pos(480, 320, 560, 352), column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
    measure('Estoque Atual (Peças)', 'Estoque (peças)'), {
      color: C.gold,
      tooltips: [measure('Data da Posição de Estoque', 'Data da posição')],
      title: 'Estoque por tipo de peça', subtitle: 'Peças na posição mais recente · ordem decrescente',
      alt: 'Barras horizontais com o estoque em peças por tipo de peça na posição mais recente do período.'
    });
  p.singleSeries('columnChart', p.pos(1064, 320, 824, 352), column(DIM_DATA, 'ano_mes', { displayName: 'Mês' }),
    measure('Estoque Atual (Peças)', 'Estoque (peças)'), {
      color: C.gold, sortByCategory: true, labels: false, valueAxis: true,
      tooltips: [measure('Data da Posição de Estoque', 'Data da posição')],
      title: 'Evolução mensal do estoque (peças)', subtitle: 'Saldo no último dia de cada mês · cada coluna é uma posição, sem somar meses',
      alt: 'Colunas com o saldo de estoque em peças no fim de cada mês do período filtrado.'
    });

  // Tabela de produtos
  p.add(p.pos(32, 696, 1120, 352), {
    visualType: 'tableEx',
    query: {
      queryState: { Values: { projections: [
        column(DIM_PROD, 'codigo_produto', { displayName: 'Código' }),
        column(DIM_PROD, 'descricao', { displayName: 'Descrição' }),
        column(DIM_PROD, 'material', { displayName: 'Material' }),
        column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
        measure('Estoque Atual (Peças)', 'Disponível (peças)')
      ] } },
      sortDefinition: { sort: [{ field: measure('Estoque Atual (Peças)').field, direction: 'Descending' }], isDefaultSort: true }
    },
    objects: {
      columnHeaders: [{ properties: {
        columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true),
        backColor: color(C.page), fontColor: color(C.text), bold: bool(true), fontSize: num(10)
      } }],
      values: [{ properties: {
        backColorPrimary: color(C.white), backColorSecondary: color(C.band),
        fontColorPrimary: color(C.text), fontColorSecondary: color(C.text), fontSize: num(10)
      } }],
      total: [{ properties: { totals: bool(false) } }]
    },
    visualContainerObjects: Object.assign(L.chartChrome('Produtos e quantidade disponível',
      'Posição mais recente do período · ordenado por quantidade disponível',
      'Tabela de produtos com código, descrição, material, tipo de peça e quantidade disponível em peças.'),
      { stylePreset: [{ properties: { name: str('None') } }] })
  });

  p.singleSeries('barChart', p.pos(1176, 696, 712, 352), column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
    measure('Estoque Atual - Top 10 Produtos', 'Estoque (peças)'), {
      color: C.gold, catFont: 9,
      title: 'Top 10 produtos por quantidade disponível', subtitle: 'Peças na posição mais recente · empates na 10ª posição são exibidos',
      alt: 'Barras horizontais com os dez produtos de maior saldo de estoque em peças.'
    });
  return p;
}

// ===================== PÁGINA 3 — VENDAS =====================
function pagina3() {
  const p = new Page(P3, 'Vendas', 'c3e5a7b9d1f2');
  p.header('Vendas — desempenho comercial',
    'Receita, volume, ticket e preço efetivamente realizado · número de vendas usa identificador sintético', 1016);
  p.standardSlicers();

  p.kpiStrip(p.pos(32, 192, 1856, 104), [
    measure('Receita Realizada (Exibição)', 'Receita realizada'),
    measure('Quantidade Vendida (Exibição)', 'Quantidade vendida'),
    measure('Número de Vendas (Exibição)', 'Número de vendas'),
    measure('Ticket Médio (Exibição)', 'Ticket médio'),
    measure('Preço Médio Realizado', 'Preço médio realizado (por peça)'),
    measure('Desconto sobre Valor Marcado (%)', 'Desconto sobre o marcado')
  ], 'Indicadores de vendas: receita realizada, peças vendidas, número de vendas, ticket médio, preço médio realizado por peça e desconto sobre o valor marcado.');

  p.singleSeries('columnChart', p.pos(32, 320, 896, 352), column(DIM_DATA, 'ano_mes', { displayName: 'Mês' }),
    measure('Receita Realizada', 'Receita realizada'), {
      color: C.graphite, sortByCategory: true, labels: false, valueAxis: true, axisUnits: '1000',
      title: 'Receita realizada por mês', subtitle: 'R$ (milhares) · eixo no formato ano-mês',
      alt: 'Colunas com a receita realizada mensal no período filtrado.'
    });
  p.singleSeries('barChart', p.pos(952, 320, 456, 352), column(DIM_PROD, 'material', { displayName: 'Material' }),
    measure('Receita Realizada', 'Receita realizada'), {
      color: C.graphite, catFont: 11, labelPos: 'OutsideEnd',
      title: 'Receita por material', subtitle: 'R$ · ordem decrescente',
      alt: 'Barras horizontais com a receita realizada por material.'
    });
  p.singleSeries('barChart', p.pos(1432, 320, 456, 352), column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
    measure('Receita Realizada', 'Receita realizada'), {
      color: C.graphite, labelPos: 'OutsideEnd',
      title: 'Receita por tipo de peça', subtitle: 'R$ · ordem decrescente',
      alt: 'Barras horizontais com a receita realizada por tipo de peça.'
    });

  p.singleSeries('barChart', p.pos(32, 696, 600, 352), column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
    measure('Quantidade Vendida', 'Quantidade vendida'), {
      color: C.steel, labelPos: 'OutsideEnd',
      title: 'Quantidade vendida por tipo de peça', subtitle: 'Peças · ordem decrescente',
      alt: 'Barras horizontais com a quantidade de peças vendidas por tipo de peça.'
    });

  // Preço médio marcado × realizado por material (barras agrupadas)
  const marcado = measure('Preço Médio Marcado', 'Preço médio marcado');
  const realizado = measure('Preço Médio Realizado', 'Preço médio realizado');
  p.add(p.pos(656, 696, 600, 352), {
    visualType: 'clusteredBarChart',
    query: {
      queryState: {
        Category: { projections: [column(DIM_PROD, 'material', { displayName: 'Material' })] },
        Y: { projections: [marcado, realizado] },
        Tooltips: { projections: [measure('Desconto sobre Valor Marcado (%)', 'Desconto sobre o marcado')] }
      },
      sortDefinition: { sort: [{ field: marcado.field, direction: 'Descending' }], isDefaultSort: true }
    },
    objects: {
      dataPoint: [
        { properties: { fill: color(C.goldSoft) }, selector: { metadata: marcado.queryRef } },
        { properties: { fill: color(C.graphite) }, selector: { metadata: realizado.queryRef } }
      ],
      labels: [{ properties: { show: bool(true), fontSize: num(10), color: color(C.text), labelDisplayUnits: str('1'), labelPosition: str('OutsideEnd') } }],
      legend: [{ properties: { show: bool(true), position: str('Top'), fontSize: num(10), labelColor: color(C.text2) } }],
      categoryAxis: [{ properties: { show: bool(true), fontSize: num(11), labelColor: color(C.text), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
      valueAxis: [{ properties: { show: bool(false), showAxisTitle: bool(false), gridlineShow: bool(false) } }]
    },
    visualContainerObjects: L.chartChrome('Preço médio marcado × realizado', 'R$ por peça vendida, por material · média ponderada pela quantidade',
      'Barras agrupadas comparando o preço médio marcado e o preço médio efetivamente realizado por peça, por material.')
  });

  p.singleSeries('barChart', p.pos(1280, 696, 608, 352), column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
    measure('Receita - Top 10 Produtos', 'Receita realizada'), {
      color: C.graphite, catFont: 9, labelPos: 'OutsideEnd',
      title: 'Top 10 produtos por receita', subtitle: 'R$ · dentro dos filtros da página',
      alt: 'Barras horizontais com os dez produtos de maior receita realizada.'
    });
  return p;
}

const pages = [];
if (WHICH === '2' || WHICH === 'todas') pages.push(pagina2());
if (WHICH === '3' || WHICH === 'todas') pages.push(pagina3());
for (const pg of pages) pg.write(REPORT);
const order = [];
const pagesFile = path.join(REPORT, 'definition', 'pages');
if (fs.existsSync(path.join(pagesFile, P2, 'page.json'))) order.push(P2);
if (fs.existsSync(path.join(pagesFile, P3, 'page.json'))) order.push(P3);
const reg = L.registerPages(REPORT, VISAO_GERAL, order);
console.log(JSON.stringify({ gerado: pages.map((p) => ({ pagina: p.displayName, id: p.id, visuais: p.visuals.length })), ordem: reg.pageOrder, ativa: reg.activePageName }));
