// Página 6, opção B: tabela "Janelas comerciais por ano" sem a coluna Ano; subtítulo visível; fonte 9.
'use strict';
const fs = require('fs');
const path = require('path');
// Pasta .Report de destino: obrigatória (sem padrão), para não alterar o relatório principal por engano.
const base = process.argv[2];
if (!base || !fs.existsSync(path.join(base, 'definition', 'report.json'))) {
  console.error(`Uso: node ${path.basename(__filename)} <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.`);
  process.exit(1);
}
const file = path.join(base, 'definition', 'pages', 'f6b8d0a2c4e6f8a0b006', 'visuals', 'f6b8d0a2c4e6000b0000', 'visual.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const vco = j.visual.visualContainerObjects;
if (vco.title[0].properties.text.expr.Literal.Value !== "'Janelas comerciais por ano'") throw new Error('Visual inesperado');
const proj = j.visual.query.queryState.Values.projections;
const antes = proj.length;
j.visual.query.queryState.Values.projections = proj.filter((p) => p.queryRef !== 'bi_demo vw_dim_data.ano');
if (j.visual.query.queryState.Values.projections.length !== antes - 1) throw new Error('Projeção Ano não encontrada');
if (j.filterConfig && j.filterConfig.filters) {
  j.filterConfig.filters = j.filterConfig.filters.filter((f) => JSON.stringify(f.field).indexOf('"Property":"ano"') < 0);
}
vco.subTitle[0].properties.show.expr.Literal.Value = 'true';
vco.subTitle[0].properties.text.expr.Literal.Value = "'Cada janela inclui os dias que antecedem a data comercial e a própria data'";
j.visual.objects.columnHeaders[0].properties.fontSize.expr.Literal.Value = '9D';
j.visual.objects.values[0].properties.fontSize.expr.Literal.Value = '9D';
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('projeções: ' + j.visual.query.queryState.Values.projections.map((p) => p.displayName || p.nativeQueryRef).join(' | '));
console.log('subtítulo visível, fonte 9');
