// Página 6: oculta somente o subtítulo da tabela "Janelas comerciais por ano" (subTitle.show = false).
'use strict';
const fs = require('fs');
const path = require('path');
// Pasta .Report de destino: obrigatória (sem padrão), para não alterar o relatório principal por engano.
const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) {
  console.error(`Uso: node ${path.basename(__filename)} <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.`);
  process.exit(1);
}
const dir = path.join(REPORT, 'definition', 'pages', 'f6b8d0a2c4e6f8a0b006', 'visuals');
let feitos = 0;
for (const id of fs.readdirSync(dir)) {
  const file = path.join(dir, id, 'visual.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const vco = j.visual.visualContainerObjects || {};
  const t = vco.title?.[0]?.properties?.text?.expr?.Literal?.Value;
  if (t === "'Janelas comerciais por ano'") {
    const show = vco.subTitle[0].properties.show.expr.Literal;
    const antes = show.Value; show.Value = 'false';
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`${id} subTitle.show: ${antes} -> false`); feitos++;
  }
}
if (feitos !== 1) { console.error(`Esperava 1 visual, ajustei ${feitos}.`); process.exit(1); }
