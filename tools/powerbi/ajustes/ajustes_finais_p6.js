// Página 6: (1) subtítulo do Top 10 de lift; (2) fonte 8 na tabela de janelas comerciais. Só essas propriedades mudam.
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
const titulo = (j) => (((j.visual.visualContainerObjects || {}).title || [])[0] || { properties: {} }).properties.text?.expr?.Literal?.Value;
let feitos = 0;
for (const id of fs.readdirSync(dir)) {
  const file = path.join(dir, id, 'visual.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const t = titulo(j);
  if (t === "'Top 10 regras de produtos por lift'") {
    const lit = j.visual.visualContainerObjects.subTitle[0].properties.text.expr.Literal;
    const antes = lit.Value; lit.Value = "'Mín. 5 vendas conjuntas · pares nos dois sentidos'";
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`${id} subtítulo: ${antes} -> ${lit.Value}`); feitos++;
  } else if (t === "'Janelas comerciais por ano'") {
    const ch = j.visual.objects.columnHeaders[0].properties.fontSize.expr.Literal;
    const va = j.visual.objects.values[0].properties.fontSize.expr.Literal;
    const antes = `${ch.Value}/${va.Value}`; ch.Value = '8D'; va.Value = '8D';
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`${id} fonte (cabeçalho/valores): ${antes} -> 8D/8D`); feitos++;
  }
}
if (feitos !== 2) { console.error(`Esperava 2 visuais, ajustei ${feitos}.`); process.exit(1); }
