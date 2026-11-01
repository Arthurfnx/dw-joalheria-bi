// Opção B (página 5): altera somente position.x/position.width de dois visuais, preservando o restante do JSON.
'use strict';
const fs = require('fs');
const path = require('path');
// Pasta .Report de destino: obrigatória (sem padrão), para não alterar o relatório principal por engano.
const REPORT = process.argv[2];
if (!REPORT || !fs.existsSync(path.join(REPORT, 'definition', 'report.json'))) {
  console.error(`Uso: node ${path.basename(__filename)} <pasta .Report de destino>\nInforme uma pasta .Report válida (de preferência uma cópia de trabalho). Nenhum arquivo foi alterado.`);
  process.exit(1);
}
const base = path.join(REPORT, 'definition', 'pages', 'e5a7c9e1f3b5d7f9a005', 'visuals');
const alvos = [
  { id: 'e5a7c9e1f3b5000d0000', tipo: 'lineChart', x: 32, width: 656 },
  { id: 'e5a7c9e1f3b5000e0000', tipo: 'clusteredBarChart', x: 712, width: 344 }
];
for (const a of alvos) {
  const file = path.join(base, a.id, 'visual.json');
  const raw = fs.readFileSync(file, 'utf8');
  const j = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (j.visual.visualType !== a.tipo) throw new Error(`Tipo inesperado em ${a.id}: ${j.visual.visualType}`);
  const antes = { x: j.position.x, width: j.position.width };
  j.position.x = a.x;
  j.position.width = a.width;
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log(`${a.id} ${a.tipo}: x ${antes.x}->${a.x}, largura ${antes.width}->${a.width}`);
}
