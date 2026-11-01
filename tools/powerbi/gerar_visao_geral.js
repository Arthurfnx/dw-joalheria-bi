// Gerador determinístico da página "Visão Geral" (PBIR) — relatorio_joalheria_demo
// Uso: node gerar_visao_geral.js <caminho-da-pasta-.Report>
'use strict';
const fs = require('fs');
const path = require('path');

const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) {
  console.error('Uso: node gerar_visao_geral.js <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.');
  process.exit(1);
}
const DEF = path.join(REPORT, 'definition');

// IDs fixos (gerador idempotente: reexecutar sobrescreve a mesma página/visuais)
const PAGE_ID = 'a7c3e91f5b2d48e6a0f1';
const THEME_FILE = 'JoalheriaGrafite-9c41d7a2.json';
const SCHEMA_VISUAL = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.14.0/schema.json';
const SCHEMA_PAGE = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json';

// Paleta
const C = {
  graphite: '#2B2D31', gold: '#A8874E', goldLight: '#E3C98F', page: '#F6F4EF',
  white: '#FFFFFF', border: '#E5DFD3', text: '#1F2124', text2: '#5F6368', tint: '#F6F4EF'
};

// ---------- helpers de codificação PBIR ----------
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${String(s).replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? 'true' : 'false');
const color = (hex) => ({ solid: { color: str(hex) } });

const measure = (name, displayName) => {
  const p = {
    field: { Measure: { Expression: { SourceRef: { Entity: 'Medidas' } }, Property: name } },
    queryRef: `Medidas.${name}`,
    nativeQueryRef: name
  };
  if (displayName) p.displayName = displayName;
  return p;
};
const column = (entity, prop, extra = {}) => ({
  field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } },
  queryRef: `${entity}.${prop}`,
  nativeQueryRef: prop,
  ...extra
});

const vcoPadding = (t, r, b, l) => [{ properties: { top: num(t), right: num(r), bottom: num(b), left: num(l) } }];
const chartChrome = (title, subtitle, altText) => ({
  title: [{ properties: {
    show: bool(true), text: str(title), fontFamily: str('Segoe UI Semibold'),
    fontSize: num(13), fontColor: color(C.text), alignment: str('left')
  } }],
  subTitle: [{ properties: {
    show: bool(true), text: str(subtitle), fontFamily: str('Segoe UI'),
    fontSize: num(10), fontColor: color(C.text2), alignment: str('left')
  } }],
  padding: vcoPadding(12, 16, 12, 16),
  general: [{ properties: { altText: str(altText) } }]
});

let z = 0;
const pos = (x, y, w, h) => { z += 1000; return { x, y, z, height: h, width: w, tabOrder: z }; };

const visuals = [];
const add = (name, position, visual) => visuals.push({ $schema: SCHEMA_VISUAL, name, position, visual });

// Textbox com parágrafos nativos
const paragraph = (text, style, align = 'left') => ({
  textRuns: [{ value: text, textStyle: style }],
  horizontalTextAlignment: align
});
const textbox = (name, position, paragraphs, vco) => add(name, position, {
  visualType: 'textbox',
  objects: { general: [{ properties: { paragraphs } }] },
  visualContainerObjects: vco
});
const noChrome = (padT = 0, padR = 0, padB = 0, padL = 0) => ({
  background: [{ properties: { show: bool(false) } }],
  border: [{ properties: { show: bool(false) } }],
  padding: vcoPadding(padT, padR, padB, padL)
});

// ---------- 1. Faixa de aviso (obrigatória) ----------
textbox('b1a0c0de0000000000a1', pos(0, 0, 1920, 48), [
  paragraph('AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.',
    { fontFamily: 'Segoe UI Semibold', fontSize: '11pt', color: C.goldLight }, 'center')
], {
  background: [{ properties: { show: bool(true), color: color(C.graphite), transparency: num(0) } }],
  border: [{ properties: { show: bool(false) } }],
  padding: vcoPadding(12, 16, 8, 16)
});

// ---------- 2. Título e subtítulo ----------
textbox('b1a0c0de0000000000a2', pos(32, 64, 1180, 48), [
  paragraph('Visão Geral — receita, vendas e estoque',
    { fontFamily: 'Segoe UI Semibold', fontSize: '20pt', color: C.text })
], noChrome());
textbox('b1a0c0de0000000000a3', pos(32, 120, 1180, 24), [
  paragraph('Joalheria demonstrativa · use os filtros de Ano, Período e Material para recortar todos os indicadores',
    { fontFamily: 'Segoe UI', fontSize: '11pt', color: C.text2 })
], noChrome());

// ---------- 3. Filtros (faixa direita do cabeçalho) ----------
const slicer = (name, position, col, header, mode) => add(name, position, {
  visualType: 'slicer',
  query: { queryState: { Values: { projections: [col] } } },
  objects: {
    data: [{ properties: { mode: str(mode) } }],
    header: [{ properties: { show: bool(true), text: str(header) } }]
  },
  visualContainerObjects: { padding: vcoPadding(8, 8, 8, 8) }
});
slicer('b1a0c0de0000000000b1', pos(1264, 64, 160, 104), column('bi_demo vw_dim_data', 'ano'), 'Ano', 'Dropdown');
slicer('b1a0c0de0000000000b2', pos(1448, 64, 216, 104), column('bi_demo vw_dim_data', 'data'), 'Período', 'Between');
slicer('b1a0c0de0000000000b3', pos(1688, 64, 200, 104), column('bi_demo vw_dim_produto', 'material'), 'Material', 'Dropdown');

// ---------- 4. Faixa de KPIs (cardVisual multivalor) ----------
const cardObjects = (valueSize, labelSize) => ({
  value: [{ properties: { fontSize: num(valueSize), fontColor: color(C.text), bold: bool(true) }, selector: { id: 'default' } }],
  label: [{ properties: { show: bool(true), fontSize: num(labelSize), fontColor: color(C.text2), position: str('aboveValue') }, selector: { id: 'default' } }],
  padding: [{ properties: { paddingUniform: num(8) }, selector: { id: 'default' } }],
  outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }]
});
add('b1a0c0de0000000000c1', pos(32, 192, 1856, 104), {
  visualType: 'cardVisual',
  query: { queryState: { Data: { projections: [
    measure('Receita Realizada (Exibição)', 'Receita realizada'),
    measure('Número de Vendas (Exibição)', 'Número de vendas'),
    measure('Quantidade Vendida (Exibição)', 'Quantidade vendida'),
    measure('Ticket Médio (Exibição)', 'Ticket médio')
  ] } } },
  objects: {
    ...cardObjects(28, 12),
    layout: [{ properties: {
      paddingUniform: num(0), style: str('Table'), customizeLines: bool(true),
      gridlineWidth: num(1), gridlineColor: color(C.border), gridlineTransparency: num(0), gridlineStyle: str('solid')
    }, selector: { id: 'default' } }],
    accentBar: [{ properties: { show: bool(true), position: str('Top'), width: num(3), color: color(C.gold) }, selector: { id: 'default' } }]
  },
  visualContainerObjects: {
    padding: [{ properties: { top: num(8), bottom: num(8), left: num(8), right: num(8) }, selector: { id: 'default' } }],
    spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
    general: [{ properties: { altText: str('Indicadores: receita realizada, número de vendas, quantidade vendida em peças e ticket médio, conforme os filtros.') } }]
  }
});

// ---------- 5. Tendência mensal da receita ----------
add('b1a0c0de0000000000d1', pos(32, 320, 1120, 400), {
  visualType: 'lineChart',
  query: {
    queryState: {
      Category: { projections: [column('bi_demo vw_dim_data', 'ano_mes', { displayName: 'Mês', active: true })] },
      Y: { projections: [measure('Receita Realizada', 'Receita realizada')] }
    },
    sortDefinition: { sort: [{ field: { Column: { Expression: { SourceRef: { Entity: 'bi_demo vw_dim_data' } }, Property: 'ano_mes' } }, direction: 'Ascending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [{ properties: { defaultColor: color(C.graphite) } }],
    lineStyles: [{ properties: { strokeWidth: num(3), lineChartType: str('linear'), areaShow: bool(true), areaMatchStrokeColor: bool(true), showMarker: bool(true), markerSize: num(4), markerColor: color(C.gold) } }],
    labels: [{ properties: { show: bool(false) } }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(10), labelColor: color(C.text2), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
    valueAxis: [{ properties: { show: bool(true), fontSize: num(10), labelColor: color(C.text2), showAxisTitle: bool(false), labelDisplayUnits: str('1000'), gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } }]
  },
  visualContainerObjects: chartChrome('Receita realizada por mês', 'Jan/2024 a dez/2025 · R$ (milhares) · eixo no formato ano-mês',
    'Gráfico de linhas com a receita realizada mensal entre janeiro de 2024 e dezembro de 2025.')
});

// ---------- 6. Receita por material ----------
const barByMaterial = (name, position, y, tooltips, fill, title, subtitle, alt, labelFmt) => add(name, position, {
  visualType: 'barChart',
  query: {
    queryState: Object.assign(
      { Category: { projections: [column('bi_demo vw_dim_produto', 'material', { displayName: 'Material' })] },
        Y: { projections: [y] } },
      tooltips ? { Tooltips: { projections: [tooltips] } } : {}
    ),
    sortDefinition: { sort: [{ field: y.field, direction: 'Descending' }], isDefaultSort: true }
  },
  objects: {
    dataPoint: [{ properties: { defaultColor: color(fill) } }],
    labels: [{ properties: Object.assign({ show: bool(true), fontSize: num(11), color: color(C.text) }, labelFmt || {}) }],
    categoryAxis: [{ properties: { show: bool(true), fontSize: num(11), labelColor: color(C.text), showAxisTitle: bool(false) } }],
    valueAxis: [{ properties: { show: bool(false), showAxisTitle: bool(false), gridlineShow: bool(false) } }]
  },
  visualContainerObjects: chartChrome(title, subtitle, alt)
});
barByMaterial('b1a0c0de0000000000d2', pos(1176, 320, 712, 400),
  measure('Receita Realizada', 'Receita realizada'), null, C.graphite,
  'Receita realizada por material', 'R$ · Ouro, Prata e Folheado · respeita Ano e Período',
  'Barras horizontais com a receita realizada por material, em ordem decrescente.',
  { labelDisplayUnits: str('0') });

// ---------- 7. Bloco informativo ----------
add('b1a0c0de0000000000e1', pos(32, 744, 1120, 304), {
  visualType: 'shape',
  objects: {
    shape: [{ properties: { tileShape: str('rectangleRoundedByPixel'), rectangleRoundedCurve: int(8) }, selector: { id: 'default' } }],
    fill: [{ properties: { show: bool(true), fillColor: color(C.white), transparency: num(0) }, selector: { id: 'default' } }],
    outline: [{ properties: { show: bool(true), lineColor: color(C.border), weight: num(1) }, selector: { id: 'default' } }]
  },
  visualContainerObjects: {
    background: [{ properties: { show: bool(false) } }],
    border: [{ properties: { show: bool(false) } }],
    padding: vcoPadding(0, 0, 0, 0),
    general: [{ properties: { altText: str('Fundo do bloco informativo sobre os dados da demonstração.') } }]
  }
});
textbox('b1a0c0de0000000000e2', pos(56, 760, 1072, 32), [
  paragraph('Sobre os dados desta demonstração', { fontFamily: 'Segoe UI Semibold', fontSize: '13pt', color: C.text })
], noChrome());
add('b1a0c0de0000000000e3', pos(56, 800, 1072, 88), {
  visualType: 'cardVisual',
  query: { queryState: { Data: { projections: [
    measure('Período Selecionado (Exibição)', 'Período selecionado'),
    measure('Data da Posição de Estoque', 'Posição de estoque exibida')
  ] } } },
  objects: {
    ...cardObjects(16, 11),
    cardCalloutArea: [{ properties: { show: bool(true), paddingUniform: int(8), rectangleRoundedCurve: int(6), backgroundFillColor: color(C.tint), backgroundTransparency: num(0) } }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }]
  },
  visualContainerObjects: {
    background: [{ properties: { show: bool(false) } }],
    border: [{ properties: { show: bool(false) } }],
    padding: [{ properties: { top: num(8), bottom: num(8), left: num(0), right: num(0) }, selector: { id: 'default' } }],
    spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
    general: [{ properties: { altText: str('Período filtrado no calendário e data da posição de estoque usada no gráfico de estoque.') } }]
  }
});
const noteStyle = { fontFamily: 'Segoe UI', fontSize: '10pt', color: C.text2 };
textbox('b1a0c0de0000000000e4', pos(56, 904, 1072, 136), [
  paragraph('• Todos os registros são sintéticos (origem SINTETICO_DEMO), gerados de forma determinística no PostgreSQL; não representam resultados reais da empresa.', noteStyle),
  paragraph('• Período coberto pelos dados: 01/01/2024 a 31/12/2025. O estoque é observado em posições mensais (último dia de cada mês) e o gráfico mostra somente a posição mais recente dentro do filtro, sem somar meses.', noteStyle),
  paragraph('• Número de vendas e ticket médio usam um identificador de venda artificial, válido apenas nesta demonstração. Margem, CMV e giro não são calculados nesta fase.', noteStyle)
], noChrome());

// ---------- 8. Estoque por material ----------
barByMaterial('b1a0c0de0000000000d3', pos(1176, 744, 712, 304),
  measure('Estoque Atual (Peças)', 'Estoque (peças)'), measure('Data da Posição de Estoque', 'Data da posição'), C.gold,
  'Estoque por material (peças)', 'Posição mais recente disponível no período filtrado · não soma meses',
  'Barras horizontais com o estoque em peças por material na posição mensal mais recente do período filtrado.',
  null);

// ---------- Gravação: página ----------
const pageDir = path.join(DEF, 'pages', PAGE_ID);
fs.rmSync(pageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(pageDir, 'visuals'), { recursive: true });
const page = {
  $schema: SCHEMA_PAGE,
  name: PAGE_ID,
  displayName: 'Visão Geral',
  displayOption: 'FitToPage',
  height: 1080,
  width: 1920,
  objects: {
    background: [{ properties: { color: color(C.page), transparency: num(0) } }],
    outspace: [{ properties: { color: color(C.page), transparency: num(0) } }]
  }
};
const write = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
write(path.join(pageDir, 'page.json'), page);
for (const v of visuals) {
  const d = path.join(pageDir, 'visuals', v.name);
  fs.mkdirSync(d, { recursive: true });
  write(path.join(d, 'visual.json'), v);
}

// ---------- pages.json ----------
const pagesFile = path.join(DEF, 'pages', 'pages.json');
const pages = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
pages.pageOrder = [PAGE_ID, ...pages.pageOrder.filter((p) => p !== PAGE_ID)];
pages.activePageName = PAGE_ID;
write(pagesFile, pages);

// ---------- Tema ----------
const theme = {
  $schema: 'https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.153.json',
  name: THEME_FILE,
  dataColors: [C.graphite, C.gold, '#6E7781', '#C9B27C', '#4A5560', '#8C6D3F', '#9AA3AD', '#D9C9A3'],
  good: '#2E7D5B', neutral: '#B8975A', bad: '#B23A3A',
  maximum: C.graphite, center: C.gold, minimum: '#EFE6D2', null: '#9AA3AD',
  foreground: C.text, background: C.white, tableAccent: C.gold,
  textClasses: {
    callout: { fontSize: 28, fontFace: 'Segoe UI Semibold', color: C.text },
    title: { fontSize: 13, fontFace: 'Segoe UI Semibold', color: C.text },
    header: { fontSize: 12, fontFace: 'Segoe UI Semibold', color: C.text },
    label: { fontSize: 10, fontFace: 'Segoe UI', color: C.text }
  },
  visualStyles: {
    '*': { '*': {
      background: [{ show: true, color: { solid: { color: C.white } }, transparency: 0 }],
      border: [{ show: true, color: { solid: { color: C.border } }, radius: 8, width: 1 }],
      dropShadow: [{ show: false }],
      padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
      visualHeader: [{ show: false }],
      title: [{ fontColor: { solid: { color: C.text } }, fontFamily: 'Segoe UI Semibold' }],
      categoryAxis: [{ gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.border } } }],
      valueAxis: [{ gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.border } } }]
    } },
    tableEx: { '*': {
      columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: 'growToFit', backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
      values: [{ backColorPrimary: { solid: { color: C.white } }, backColorSecondary: { solid: { color: '#FBFAF7' } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }]
    } },
    pivotTable: { '*': {
      columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: 'growToFit', backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
      values: [{ backColorPrimary: { solid: { color: C.white } }, backColorSecondary: { solid: { color: '#FBFAF7' } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }]
    } },
    cardVisual: { '*': {
      value: [{ bold: true, $id: 'default' }],
      label: [{ show: true, $id: 'default' }],
      cardCalloutArea: [{ paddingUniform: 0 }],
      title: [{ show: false }]
    } },
    textbox: { '*': {
      padding: [{ top: 0, bottom: 0, left: 0, right: 0 }],
      background: [{ show: false }],
      border: [{ show: false }]
    } },
    shape: { '*': {
      background: [{ show: false }],
      border: [{ show: false }]
    } },
    barChart: { '*': {
      labels: [{ show: true, fontSize: 10 }],
      valueAxis: [{ show: false, gridlineShow: false, showAxisTitle: false }],
      categoryAxis: [{ show: true, fontSize: 10, labelColor: { solid: { color: C.text2 } }, showAxisTitle: false, innerPadding: 20, gridlineShow: false }],
      dataPoint: [{ borderShow: false }],
      legend: [{ show: false }]
    } },
    lineChart: { '*': {
      lineStyles: [{ strokeWidth: 2.5, lineChartType: 'linear', areaShow: true, areaMatchStrokeColor: true }],
      dataPoint: [{ transparency: 88 }],
      labels: [{ show: false }],
      categoryAxis: [{ show: true, fontSize: 10, labelColor: { solid: { color: C.text2 } }, showAxisTitle: false, gridlineShow: false }],
      valueAxis: [{ show: true, fontSize: 9, labelColor: { solid: { color: C.text2 } }, showAxisTitle: false, gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.border } } }],
      legend: [{ show: false }]
    } },
    slicer: { '*': {
      header: [{ fontFamily: 'Segoe UI Semibold', textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0 }],
      items: [{ fontFamily: 'Segoe UI', textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0, padding: 2 }],
      date: [{ fontFamily: 'Segoe UI', textSize: 10, fontColor: { solid: { color: C.text } } }]
    } }
  }
};
const regDir = path.join(REPORT, 'StaticResources', 'RegisteredResources');
fs.mkdirSync(regDir, { recursive: true });
for (const f of fs.readdirSync(regDir)) {
  if (/^JoalheriaGrafite-[0-9a-f]+\.json$/.test(f) && f !== THEME_FILE) fs.rmSync(path.join(regDir, f));
}
write(path.join(regDir, THEME_FILE), theme);

// ---------- report.json: registrar tema ----------
const reportFile = path.join(DEF, 'report.json');
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
report.themeCollection.customTheme = {
  name: THEME_FILE,
  reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport,
  type: 'RegisteredResources'
};
report.resourcePackages = report.resourcePackages.filter((p) => p.type !== 'RegisteredResources');
report.resourcePackages.push({
  name: 'RegisteredResources',
  type: 'RegisteredResources',
  items: [{ name: THEME_FILE, path: THEME_FILE, type: 'CustomTheme' }]
});
write(reportFile, report);

console.log(JSON.stringify({ page: PAGE_ID, visuals: visuals.length, theme: THEME_FILE }));
