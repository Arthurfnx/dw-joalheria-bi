// Biblioteca de apoio para gerar PBIR no padrão visual do relatorio_joalheria_demo
'use strict';
const fs = require('fs');
const path = require('path');

const SCHEMA_VISUAL = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.14.0/schema.json';
const SCHEMA_PAGE = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json';
const AVISO = 'AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.';

const C = {
  graphite: '#2B2D31', gold: '#A8874E', goldLight: '#E3C98F', goldSoft: '#C9B27C', steel: '#6E7781',
  page: '#F6F4EF', white: '#FFFFFF', border: '#E5DFD3', text: '#1F2124', text2: '#5F6368', tint: '#F6F4EF', band: '#FBFAF7'
};

const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${String(s).replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? 'true' : 'false');
const color = (hex) => ({ solid: { color: str(hex) } });
const vcoPadding = (t, r, b, l) => [{ properties: { top: num(t), right: num(r), bottom: num(b), left: num(l) } }];

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
const DIM_DATA = 'bi_demo vw_dim_data';
const DIM_PROD = 'bi_demo vw_dim_produto';

class Page {
  constructor(id, displayName, prefix) {
    this.id = id; this.displayName = displayName; this.prefix = prefix;
    this.visuals = []; this.z = 0; this.seq = 0;
  }
  nextName() { this.seq += 1; return (this.prefix + this.seq.toString(16).padStart(4, '0')).padEnd(20, '0').slice(0, 20); }
  pos(x, y, w, h) { this.z += 1000; return { x, y, z: this.z, height: h, width: w, tabOrder: this.z }; }
  add(position, visual) { const name = this.nextName(); this.visuals.push({ $schema: SCHEMA_VISUAL, name, position, visual }); return name; }

  textbox(position, paragraphs, vco) {
    return this.add(position, { visualType: 'textbox', objects: { general: [{ properties: { paragraphs } }] }, visualContainerObjects: vco });
  }

  // Faixa de aviso + título + subtítulo (mesmo padrão da Visão Geral)
  header(title, subtitle, titleWidth) {
    this.textbox(this.pos(0, 0, 1920, 48), [para(AVISO, { fontFamily: 'Segoe UI Semibold', fontSize: '11pt', color: C.goldLight }, 'center')], {
      background: [{ properties: { show: bool(true), color: color(C.graphite), transparency: num(0) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: vcoPadding(12, 16, 8, 16)
    });
    this.textbox(this.pos(32, 64, titleWidth, 48), [para(title, { fontFamily: 'Segoe UI Semibold', fontSize: '20pt', color: C.text })], noChrome());
    this.textbox(this.pos(32, 120, titleWidth, 24), [para(subtitle, { fontFamily: 'Segoe UI', fontSize: '11pt', color: C.text2 })], noChrome());
  }

  slicer(position, col, headerText, mode) {
    return this.add(position, {
      visualType: 'slicer',
      query: { queryState: { Values: { projections: [col] } } },
      objects: { data: [{ properties: { mode: str(mode) } }], header: [{ properties: { show: bool(true), text: str(headerText) } }] },
      visualContainerObjects: { padding: vcoPadding(8, 8, 8, 8) }
    });
  }

  // Filtros padrão: Ano, Período, Material, Tipo de peça (alinhados à direita do cabeçalho)
  standardSlicers() {
    this.slicer(this.pos(1072, 64, 144, 104), column(DIM_DATA, 'ano'), 'Ano', 'Dropdown');
    this.slicer(this.pos(1240, 64, 216, 104), column(DIM_DATA, 'data'), 'Período', 'Between');
    this.slicer(this.pos(1480, 64, 184, 104), column(DIM_PROD, 'material'), 'Material', 'Dropdown');
    this.slicer(this.pos(1688, 64, 200, 104), column(DIM_PROD, 'tipo_peca'), 'Tipo de peça', 'Dropdown');
  }

  kpiStrip(position, projections, altText, valueUnits, showBlankAs) {
    const valueProps = { fontSize: num(28), fontColor: color(C.text), bold: bool(true) };
    if (valueUnits) valueProps.labelDisplayUnits = str(valueUnits);
    if (showBlankAs !== undefined) valueProps.showBlankAs = str(showBlankAs);
    return this.add(position, {
      visualType: 'cardVisual',
      query: { queryState: { Data: { projections } } },
      objects: {
        value: [{ properties: valueProps, selector: { id: 'default' } }],
        label: [{ properties: { show: bool(true), fontSize: num(12), fontColor: color(C.text2), position: str('aboveValue') }, selector: { id: 'default' } }],
        padding: [{ properties: { paddingUniform: num(8) }, selector: { id: 'default' } }],
        outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
        layout: [{ properties: {
          paddingUniform: num(0), style: str('Table'), customizeLines: bool(true),
          gridlineWidth: num(1), gridlineColor: color(C.border), gridlineTransparency: num(0), gridlineStyle: str('solid')
        }, selector: { id: 'default' } }],
        accentBar: [{ properties: { show: bool(true), position: str('Top'), width: num(3), color: color(C.gold) }, selector: { id: 'default' } }]
      },
      visualContainerObjects: {
        padding: [{ properties: { top: num(8), bottom: num(8), left: num(8), right: num(8) }, selector: { id: 'default' } }],
        spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
        general: [{ properties: { altText: str(altText) } }]
      }
    });
  }

  // Barras horizontais (barChart) ou colunas (columnChart) com uma medida
  singleSeries(type, position, category, y, opts) {
    const sortField = opts.sortByCategory ? category.field : y.field;
    const qs = { Category: { projections: [category] }, Y: { projections: [y] } };
    if (opts.tooltips) qs.Tooltips = { projections: opts.tooltips };
    const labels = Object.assign({ show: bool(opts.labels !== false), fontSize: num(10), color: color(C.text) },
      opts.labelUnits ? { labelDisplayUnits: str(opts.labelUnits) } : {},
      opts.labelPos ? { labelPosition: str(opts.labelPos) } : {});
    return this.add(position, {
      visualType: type,
      query: {
        queryState: qs,
        sortDefinition: { sort: [{ field: sortField, direction: opts.sortByCategory ? 'Ascending' : 'Descending' }], isDefaultSort: true }
      },
      objects: {
        dataPoint: [{ properties: { defaultColor: color(opts.color) } }],
        labels: [{ properties: labels }],
        categoryAxis: [{ properties: { show: bool(true), fontSize: num(opts.catFont || 10), labelColor: color(C.text), showAxisTitle: bool(false), gridlineShow: bool(false) } }],
        valueAxis: [{ properties: Object.assign({ show: bool(!!opts.valueAxis), showAxisTitle: bool(false), fontSize: num(10), labelColor: color(C.text2) },
          opts.valueAxis ? { gridlineShow: bool(true), gridlineColor: color(C.border), gridlineStyle: str('dotted') } : { gridlineShow: bool(false) },
          opts.axisUnits ? { labelDisplayUnits: str(opts.axisUnits) } : {}) }]
      },
      visualContainerObjects: chartChrome(opts.title, opts.subtitle, opts.alt)
    });
  }

  write(reportDir) {
    const def = path.join(reportDir, 'definition');
    const pageDir = path.join(def, 'pages', this.id);
    fs.rmSync(pageDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(pageDir, 'visuals'), { recursive: true });
    writeJson(path.join(pageDir, 'page.json'), {
      $schema: SCHEMA_PAGE, name: this.id, displayName: this.displayName, displayOption: 'FitToPage', height: 1080, width: 1920,
      objects: {
        background: [{ properties: { color: color(C.page), transparency: num(0) } }],
        outspace: [{ properties: { color: color(C.page), transparency: num(0) } }]
      }
    });
    for (const v of this.visuals) {
      const d = path.join(pageDir, 'visuals', v.name);
      fs.mkdirSync(d, { recursive: true });
      writeJson(path.join(d, 'visual.json'), v);
    }
  }
}

function para(text, style, align = 'left') { return { textRuns: [{ value: text, textStyle: style }], horizontalTextAlignment: align }; }
function noChrome() { return { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }], padding: vcoPadding(0, 0, 0, 0) }; }
function chartChrome(title, subtitle, altText) {
  return {
    title: [{ properties: { show: bool(true), text: str(title), fontFamily: str('Segoe UI Semibold'), fontSize: num(13), fontColor: color(C.text), alignment: str('left') } }],
    subTitle: [{ properties: { show: bool(true), text: str(subtitle), fontFamily: str('Segoe UI'), fontSize: num(10), fontColor: color(C.text2), alignment: str('left') } }],
    padding: vcoPadding(12, 16, 12, 16),
    general: [{ properties: { altText: str(altText) } }]
  };
}
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

// Insere páginas logo após a Visão Geral, preservando a ordem das demais e a página ativa
function registerPages(reportDir, anchorId, newIds) {
  const file = path.join(reportDir, 'definition', 'pages', 'pages.json');
  const pages = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rest = pages.pageOrder.filter((p) => !newIds.includes(p));
  const idx = rest.indexOf(anchorId);
  const ordered = idx >= 0 ? [...rest.slice(0, idx + 1), ...newIds, ...rest.slice(idx + 1)] : [...rest, ...newIds];
  pages.pageOrder = ordered;
  writeJson(file, pages);
  return pages;
}

module.exports = { C, lit, str, num, int, bool, color, vcoPadding, measure, column, DIM_DATA, DIM_PROD, Page, para, noChrome, chartChrome, writeJson, registerPages };
