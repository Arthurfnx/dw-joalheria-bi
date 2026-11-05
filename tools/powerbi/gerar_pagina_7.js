// Gera a página 7 (Análise de Estoque sem Venda e Movimentação) do relatorio_joalheria_demo
// Uso: node gerar_pagina_7.js <pasta-.Report>
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./pbir_lib');

const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) { console.error('Uso: node gerar_pagina_7.js <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.'); process.exit(1); }
const { C, str, num, bool, color, measure, column, DIM_PROD, Page } = L;

const P6 = 'f6b8d0a2c4e6f8a0b006';
const P7 = 'b7e3c9d1f5a7b9c1d007';
const ESTOQUE = 'Estoque Atual (Peças)';

const p = new Page(P7, 'Análise de Estoque sem Venda e Movimentação', 'b7e3c9d1f5a7');
p.header('Estoque sem Venda e Movimentação',
  'Referência: posição de estoque mais recente do filtro · dias calculados por produto/modelo, não por unidade física', 1016);
p.standardSlicers();

// Indicadores gerais
p.kpiStrip(p.pos(32, 184, 1856, 96), [
  measure('Data da Posição de Estoque', 'Data de referência'),
  measure('Produtos com Estoque', 'Produtos em estoque'),
  measure(ESTOQUE, 'Unidades em estoque (peças)'),
  measure('Produtos em Estoque sem Venda Registrada', 'Sem venda registrada'),
  measure('Produtos em Estoque sem Movimentação após o Saldo Inicial', 'Sem movimentação após saldo inicial')
], 'Data de referência, produtos e unidades em estoque, produtos em estoque sem venda registrada e sem movimentação após o saldo inicial.', '1', '0');

// Observação: os dois últimos cartões não são somáveis (um contém o outro).
p.textbox(p.pos(1072, 282, 816, 20), [
  L.para('Os produtos sem movimentação após o saldo inicial também estão em "Sem venda registrada" (toda venda gera movimentação); não some os dois.',
    { fontFamily: 'Segoe UI', fontSize: '8pt', color: C.text2 }, 'right')
], L.noChrome());

// Filtros fixos das tabelas: material da seção e somente produtos com estoque > 0.
const filtroMaterial = (nome, valores) => ({
  name: nome,
  field: { Column: { Expression: { SourceRef: { Entity: DIM_PROD } }, Property: 'material' } },
  type: 'Categorical',
  filter: {
    Version: 2,
    From: [{ Name: 'p', Entity: DIM_PROD, Type: 0 }],
    Where: [{ Condition: { In: {
      Expressions: [{ Column: { Expression: { SourceRef: { Source: 'p' } }, Property: 'material' } }],
      Values: valores.map((v) => [{ Literal: { Value: `'${v}'` } }])
    } } }]
  },
  isLockedInViewMode: true,
  howCreated: 'User'
});
const filtroEstoquePositivo = (nome) => ({
  name: nome,
  field: { Measure: { Expression: { SourceRef: { Entity: 'Medidas' } }, Property: ESTOQUE } },
  type: 'Advanced',
  filter: {
    Version: 2,
    From: [{ Name: 'm', Entity: 'Medidas', Type: 0 }],
    Where: [{ Condition: { Comparison: {
      ComparisonKind: 1,
      Left: { Measure: { Expression: { SourceRef: { Source: 'm' } }, Property: ESTOQUE } },
      Right: { Literal: { Value: '0L' } }
    } } }]
  },
  isLockedInViewMode: true,
  howCreated: 'User'
});

// Gradiente discreto (branco → dourado claro) nas colunas de dias; vazio fica sem cor.
const gradiente = (medida) => ({
  properties: { backColor: { solid: { color: { expr: { FillRule: {
    Input: { Measure: { Expression: { SourceRef: { Entity: 'Medidas' } }, Property: medida } },
    FillRule: { linearGradient2: {
      min: { color: { Literal: { Value: `'${C.white}'` } } },
      max: { color: { Literal: { Value: `'${C.goldLight}'` } } },
      nullColoringStrategy: { strategy: { Literal: { Value: "'noColor'" } } }
    } }
  } } } } } },
  selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: `Medidas.${medida}` }
});

const ORDEM = 'Ordem de Exibição';
const colunaOrdem = () => measure(ORDEM, '#');
const colunasComuns = () => [
  measure(ESTOQUE, 'Estoque (peças)'),
  measure('Última Venda até a Referência', 'Última venda'),
  measure('Dias sem Venda', 'Dias sem venda'),
  measure('Última Movimentação até a Referência', 'Última movimentação'),
  measure('Dias sem Movimentação', 'Dias sem movimentação'),
  measure('Última Entrada por Compra', 'Última compra'),
  measure('Situação de Venda e Movimentação', 'Situação')
];

const tabela = (position, projections, materiais, title, subtitle, alt) => {
  const name = p.add(position, {
    visualType: 'tableEx',
    query: {
      queryState: { Values: { projections } },
      sortDefinition: {
        // Um único critério (com dois, o Desktop aplicou critérios diferentes em tabelas iguais):
        // a Ordem de Exibição já combina grupo (nunca vendido sem/com movimentação, vendido) e dias.
        sort: [{ field: measure(ORDEM).field, direction: 'Ascending' }],
        isDefaultSort: true
      }
    },
    objects: {
      columnHeaders: [{ properties: {
        columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true), wordWrap: bool(true),
        backColor: color(C.page), fontColor: color(C.text), bold: bool(true), fontSize: num(9)
      } }],
      values: [
        { properties: {
          backColorPrimary: color(C.white), backColorSecondary: color(C.band),
          fontColorPrimary: color(C.text), fontColorSecondary: color(C.text), fontSize: num(9)
        } },
        gradiente('Dias sem Venda'),
        gradiente('Dias sem Movimentação')
      ],
      total: [{ properties: { totals: bool(false) } }]
    },
    visualContainerObjects: Object.assign(L.chartChrome(title, subtitle, alt), { stylePreset: [{ properties: { name: str('None') } }] })
  });
  const v = p.visuals.find((x) => x.name === name);
  v.filterConfig = { filters: [filtroMaterial(name.slice(0, 16) + 'fmat', materiais), filtroEstoquePositivo(name.slice(0, 16) + 'fest')] };
  return name;
};

// Seção A — Ouro (por código de produto; a dimensão atual não identifica peças físicas)
tabela(p.pos(32, 308, 1856, 336), [
  colunaOrdem(),
  column(DIM_PROD, 'codigo_produto', { displayName: 'Código' }),
  column(DIM_PROD, 'descricao', { displayName: 'Produto' }),
  column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
  column(DIM_PROD, 'tamanho', { displayName: 'Tamanho' }),
  column(DIM_PROD, 'peso_g', { displayName: 'Peso unitário (g)' }),
  ...colunasComuns()
], ['Ouro'], 'Ouro — produtos com estoque',
  'Cada linha é um código de produto, que pode ter mais de uma unidade · # = ordem: nunca vendidos sem movimentação, nunca vendidos com movimentação, depois mais dias sem venda',
  'Tabela dos produtos de ouro com estoque: código, tipo, tamanho, peso, estoque, última venda, dias sem venda, última movimentação, dias sem movimentação, última compra e situação.');

// Seção B — Prata e Folheado (análise agregada por produto/modelo)
tabela(p.pos(32, 656, 1856, 340), [
  colunaOrdem(),
  column(DIM_PROD, 'codigo_produto', { displayName: 'Código' }),
  column(DIM_PROD, 'descricao', { displayName: 'Produto/modelo' }),
  column(DIM_PROD, 'material', { displayName: 'Material' }),
  column(DIM_PROD, 'tipo_peca', { displayName: 'Tipo de peça' }),
  ...colunasComuns()
], ['Prata', 'Folheado'], 'Prata e Folheado — produtos/modelos com estoque',
  'Dias sem venda do modelo: não significa que todas as unidades estejam paradas desde essa data · # = ordem: nunca vendidos sem movimentação, nunca vendidos com movimentação, depois mais dias sem venda',
  'Tabela dos produtos de prata e folheado com estoque: código, material, tipo, estoque, última venda, dias sem venda, última movimentação, dias sem movimentação, última compra e situação.');

// Nota de regras e limitações
p.textbox(p.pos(32, 1004, 1856, 64), [
  L.para('Como ler: a data de referência é a posição de estoque (fim de mês) mais recente dentro do filtro. Última venda e última movimentação consideram todo o histórico até essa data, mesmo antes do período filtrado. '
    + 'Movimentação exclui o saldo inicial (implantação); entrada = compra registrada (ENTRADA_COMPRA). Vazio em "Última venda" = nunca vendido até a referência; vazio em "Última movimentação" = sem movimentação após o saldo inicial. '
    + 'Somente produtos com estoque maior que zero. Os dias valem para o produto/modelo, não para cada unidade. Sem faixas de classificação nem valor de estoque nesta versão.',
    { fontFamily: 'Segoe UI', fontSize: '9pt', color: C.text2 })
], L.noChrome());

p.write(REPORT);

// Ordem: logo após a página 6; página ativa preservada.
const arq = path.join(REPORT, 'definition', 'pages', 'pages.json');
const pages = JSON.parse(fs.readFileSync(arq, 'utf8'));
const resto = pages.pageOrder.filter((x) => x !== P7);
const i = resto.indexOf(P6);
pages.pageOrder = i >= 0 ? [...resto.slice(0, i + 1), P7, ...resto.slice(i + 1)] : [...resto, P7];
L.writeJson(arq, pages);
console.log(JSON.stringify({ pagina: p.displayName, id: P7, visuais: p.visuals.length, ordem: pages.pageOrder, ativa: pages.activePageName }));
