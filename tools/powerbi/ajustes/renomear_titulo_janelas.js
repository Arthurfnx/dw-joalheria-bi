// Página 6: altera somente o título do visual "Janelas comerciais por ano" para "Janelas comerciais".
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
const lit = j.visual.visualContainerObjects.title[0].properties.text.expr.Literal;
if (lit.Value !== "'Janelas comerciais por ano'") throw new Error('Título inesperado: ' + lit.Value);
lit.Value = "'Janelas comerciais'";
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log("título: 'Janelas comerciais por ano' -> 'Janelas comerciais'");
