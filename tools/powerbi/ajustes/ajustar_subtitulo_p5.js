// Página 5: altera somente o texto do subtítulo do visual "Entradas e saídas por material".
'use strict';
const fs = require('fs');
const path = require('path');
// Pasta .Report de destino: obrigatória (sem padrão), para não alterar o relatório principal por engano.
const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) {
  console.error(`Uso: node ${path.basename(__filename)} <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.`);
  process.exit(1);
}
const file = path.join(REPORT, 'definition', 'pages', 'e5a7c9e1f3b5d7f9a005', 'visuals', 'e5a7c9e1f3b5000e0000', 'visual.json');
const NOVO = 'Entradas: saldo inicial, compras e ajustes +';
const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
if (j.visual.visualType !== 'clusteredBarChart') throw new Error('Visual inesperado: ' + j.visual.visualType);
const lit = j.visual.visualContainerObjects.subTitle[0].properties.text.expr.Literal;
const antes = lit.Value;
lit.Value = `'${NOVO.replace(/'/g, "''")}'`;
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log(`subtítulo: ${antes} -> ${lit.Value}`);
