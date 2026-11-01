// Exporta as medidas do TMDL (somente leitura) para um arquivo .dax de documentação.
// Uso: node exportar_medidas_dax.js <Medidas.tmdl> <saida.dax>
'use strict';
const fs = require('fs');
const [, , origem, destino] = process.argv;
const linhas = fs.readFileSync(origem, 'utf8').replace(/^﻿/, '').split(/\r?\n/);

const medidas = [];
let desc = null;
let atual = null;
for (const l of linhas) {
  if (/^\t\/\/\/ /.test(l)) { desc = l.replace(/^\t\/\/\/ /, ''); continue; }
  const m = l.match(/^\tmeasure (.+?) =\s*$/);
  if (m) {
    atual = { nome: m[1].replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), desc, expr: [], formato: '', pasta: '' };
    medidas.push(atual); desc = null; continue;
  }
  if (!atual) continue;
  if (/^\t\t\t/.test(l)) { atual.expr.push(l.replace(/^\t\t\t/, '')); continue; }
  const p = l.match(/^\t\t(formatString|displayFolder):\s*(.*)$/);
  if (p) { if (p[1] === 'formatString') atual.formato = p[2]; else atual.pasta = p[2]; continue; }
  if (/^\t\S/.test(l)) { atual = null; desc = null; }
}

const pastas = [...new Set(medidas.map((x) => x.pasta))].sort();
const out = [];
out.push('// =============================================================================');
out.push('// measures.dax — EXPORTAÇÃO das medidas do modelo semântico (somente documentação)');
out.push('//');
out.push('// Fonte da verdade: powerbi/relatorio_joalheria_demo.SemanticModel/definition/tables/Medidas.tmdl');
out.push('// Este arquivo NÃO é lido pelo Power BI. Para alterar uma medida, altere o modelo');
out.push('// (Power BI Desktop ou Power BI Modeling MCP), salve o PBIP e exporte de novo.');
out.push(`// Medidas exportadas: ${medidas.length}. Tabela: Medidas. Ambiente DEMONSTRATIVO (dados sintéticos).`);
out.push('// Nomes de tabela como no modelo: \'bi_demo vw_<view>\' (views do esquema bi_demo).');
out.push('// =============================================================================');
out.push('');
out.push('DEFINE');
for (const pasta of pastas) {
  out.push('');
  out.push('    // -------------------------------------------------------------------------');
  out.push(`    // Pasta: ${pasta || '(sem pasta)'}`);
  out.push('    // -------------------------------------------------------------------------');
  for (const md of medidas.filter((x) => x.pasta === pasta)) {
    out.push('');
    if (md.desc) out.push(`    // ${md.desc}`);
    out.push(`    // Formato: ${md.formato || '(texto / padrão)'}`);
    out.push(`    MEASURE 'Medidas'[${md.nome}] =`);
    const corpo = md.expr.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    for (const c of corpo) out.push(c.length ? `        ${c}` : '');
  }
}
out.push('');
fs.writeFileSync(destino, out.join('\n'), 'utf8');
console.log(JSON.stringify({ medidas: medidas.length, pastas: pastas.map((p) => `${p}: ${medidas.filter((x) => x.pasta === p).length}`), semDescricao: medidas.filter((x) => !x.desc).map((x) => x.nome), semExpressao: medidas.filter((x) => !x.expr.join('').trim()).map((x) => x.nome) }));
