#!/usr/bin/env node
/*
 * criar_relatorio_real.js — cria a CÓPIA do relatório para o DW real.
 *
 *   powerbi/relatorio_joalheria_demo.*  (lido, nunca alterado)
 *     -> powerbi/relatorio_joalheria.pbip
 *        powerbi/relatorio_joalheria.Report
 *        powerbi/relatorio_joalheria.SemanticModel
 *
 * Faz só a parte MECÂNICA da cópia:
 *   - copia as pastas, sem .pbi/localSettings.json nem .pbi/cache.abf (o cache
 *     guarda os dados do modelo demonstrativo);
 *   - troca o esquema bi_demo por bi em todos os arquivos (tabelas
 *     'bi vw_...', consultas M Schema="bi") e renomeia os .tmdl das tabelas;
 *   - novos logicalId e displayName nos .platform, caminhos do .pbip/.pbir;
 *   - cultura pt-BR sem os metadados linguísticos (Q&A) herdados do demo.
 * O conteúdo (medidas, colunas novas, textos das páginas) é ajustado depois,
 * à mão, e o resultado versionado é a fonte da verdade (ver tools/powerbi/README.md).
 *
 * Recusa sobrescrever: se o destino existir, encerra sem gravar nada.
 * Uso: node tools\powerbi\criar_relatorio_real.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PBI = path.resolve(__dirname, '..', '..', 'powerbi');
const ORIGEM = 'relatorio_joalheria_demo';
const DESTINO = 'relatorio_joalheria';
// IDs fixos: rodar de novo (sobre um destino apagado) gera a mesma cópia.
const LOGICAL_ID = {
  Report: '5d2c8e41-7a3b-4f6e-9c1d-2b8a4e6f0c13',
  SemanticModel: 'a8f3d2c7-1e4b-4a9d-b6c5-3f7e9d1a2b84',
};

const IGNORAR = new Set(['localSettings.json', 'cache.abf']);
const TEXTO = new Set(['.json', '.tmdl', '.pbir', '.pbism', '.pbip', '.platform', '.md']);

function copiar(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const e of fs.readdirSync(origem, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const novoNome = e.name.replace(/^bi_demo /, 'bi ');
    const o = path.join(origem, e.name);
    const d = path.join(destino, novoNome);
    if (e.isDirectory()) { copiar(o, d); continue; }
    const ext = path.extname(e.name) || e.name;
    if (TEXTO.has(ext)) {
      let t = fs.readFileSync(o, 'utf8');
      t = t.replace(/bi_demo/g, 'bi');
      fs.writeFileSync(d, t, 'utf8');
    } else {
      fs.copyFileSync(o, d);
    }
  }
}

function editarJson(arquivo, f) {
  const j = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  f(j);
  fs.writeFileSync(arquivo, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

// Textos das páginas: [arquivo relativo à pasta pages, texto do demo, texto do relatório real].
// Cada texto do demo precisa existir exatamente uma vez no arquivo (senão a cópia falha).
const AVISO_DEMO = 'AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.';
const CABECALHO = 'NOBREZA JÓIAS — DADOS DO SISTEMA DE GESTÃO · vendas anteriores ao sistema vêm da planilha da loja';
const TEXTOS = [
  ...['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000a1', 'b2d4f60a1c3e5a7b9d02/visuals/b2d4f60a1c3e00010000',
      'b7e3c9d1f5a7b9c1d007/visuals/b7e3c9d1f5a700010000', 'c3e5a7b9d1f2a4c6e803/visuals/c3e5a7b9d1f200010000',
      'd4f6a8c0e2b4d6f8a004/visuals/d4f6a8c0e2b400010000', 'e5a7c9e1f3b5d7f9a005/visuals/e5a7c9e1f3b500010000',
      'f6b8d0a2c4e6f8a0b006/visuals/f6b8d0a2c4e600010000'].map(v => [v, AVISO_DEMO, CABECALHO]),
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000a3',
   'Joalheria demonstrativa · use os filtros',
   'Nobreza Jóias · use os filtros'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000e1',
   'Fundo do bloco informativo sobre os dados da demonstração.',
   'Fundo do bloco informativo sobre a origem dos dados.'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000e2',
   'Sobre os dados desta demonstração',
   'Sobre os dados deste relatório'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000e4',
   '• Todos os registros são sintéticos (origem SINTETICO_DEMO), gerados de forma determinística no PostgreSQL; não representam resultados reais da empresa.',
   '• Dados do sistema de gestão da loja. Cadastro, saldo inicial e vendas anteriores ao sistema foram importados da planilha; vendas sem valor ou com valor simbólico (R$ 0,01) não entram na receita.'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000e4',
   '• Período coberto pelos dados: 01/01/2024 a 31/12/2025. O estoque é observado em posições mensais (último dia de cada mês) e o gráfico mostra somente a posição mais recente dentro do filtro, sem somar meses.',
   '• O estoque é observado diariamente a partir da importação da planilha; não existe posição de estoque anterior. O gráfico mostra somente a posição mais recente dentro do filtro, sem somar dias.'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000e4',
   '• Número de vendas e ticket médio usam um identificador de venda artificial, válido apenas nesta demonstração. Margem, CMV e giro não são calculados nesta fase.',
   '• Número de vendas e ticket médio usam só as vendas registradas no sistema, que têm número de venda; a planilha não identifica vendas. Margem, CMV e giro não são calculados.'],
  ['b2d4f60a1c3e5a7b9d02/visuals/b2d4f60a1c3e00030000',
   'Saldo na posição mensal mais recente do período filtrado',
   'Saldo na posição diária mais recente do período filtrado (desde a importação da planilha)'],
  ['b7e3c9d1f5a7b9c1d007/visuals/b7e3c9d1f5a7000c0000',
   'a data de referência é a posição de estoque (fim de mês) mais recente',
   'a data de referência é a posição de estoque (diária, desde a importação da planilha) mais recente'],
  ['c3e5a7b9d1f2a4c6e803/visuals/c3e5a7b9d1f200030000',
   'número de vendas usa identificador sintético',
   'número de vendas e ticket só com vendas registradas no sistema; receita sem valor simbólico'],
  ['d4f6a8c0e2b4d6f8a004/visuals/d4f6a8c0e2b400030000',
   'Entradas de compra sintéticas',
   'Peças com data de aquisição no cadastro (uma linha por peça)'],
  ['f6b8d0a2c4e6f8a0b006/visuals/f6b8d0a2c4e600030000',
   'Datas comerciais e afinidades entre peças · padrões inseridos pelo gerador sintético',
   'Datas comerciais e afinidades entre peças vendidas juntas no sistema'],
  ['f6b8d0a2c4e6f8a0b006/visuals/f6b8d0a2c4e600080000',
   'os efeitos das datas comerciais foram simulados artificialmente',
   'as janelas das datas comerciais são uma convenção de análise, não informação da empresa'],
  ['f6b8d0a2c4e6f8a0b006/visuals/f6b8d0a2c4e6000f0000',
   'histórico completo jan/2024–dez/2025: NÃO responde aos filtros desta página  ·  afinidades inseridas pelo gerador sintético, não são padrões descobertos na empresa',
   'somente vendas registradas no sistema (com número de venda); NÃO responde aos filtros desta página  ·  as tabelas ficam vazias até haver vendas com mais de uma peça: os dados aparecem conforme as vendas forem registradas no sistema'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000d1',
   'Jan/2024 a dez/2025 · R$ (milhares)',
   'Mês a mês · R$ (milhares)'],
  ['a7c3e91f5b2d48e6a0f1/visuals/b1a0c0de0000000000d1',
   'receita realizada mensal entre janeiro de 2024 e dezembro de 2025.',
   'receita realizada mensal no período filtrado.'],
  ['e5a7c9e1f3b5d7f9a005/visuals/e5a7c9e1f3b5000a0000',
   'jan/2024 inclui a implantação do saldo inicial',
   'o mês da importação da planilha inclui a implantação do saldo inicial'],
];

// O seletor de período da Visão Geral guardava o filtro "data >= 01/01/2024"
// do período demonstrativo: no relatório real ele começa sem filtro.
function limparFiltroPeriodo() {
  const arq = path.join(PBI, `${DESTINO}.Report`, 'definition', 'pages', 'a7c3e91f5b2d48e6a0f1',
    'visuals', 'b1a0c0de0000000000b2', 'visual.json');
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const obj = j.visual.objects;
  delete obj.general;
  for (const d of obj.data || []) delete d.properties.startDate;
  fs.writeFileSync(arq, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

function ajustarTextos() {
  const paginas = path.join(PBI, `${DESTINO}.Report`, 'definition', 'pages');
  for (const [visual, antigo, novo] of TEXTOS) {
    const arq = path.join(paginas, ...visual.split('/'), 'visual.json');
    const t = fs.readFileSync(arq, 'utf8');
    const n = t.split(antigo).length - 1;
    if (n !== 1) throw new Error(`Texto esperado 1 vez, encontrado ${n} em ${visual}: ${antigo.slice(0, 50)}`);
    fs.writeFileSync(arq, t.replace(antigo, novo), 'utf8');
  }
}

function main() {
  const destinos = [`${DESTINO}.pbip`, `${DESTINO}.Report`, `${DESTINO}.SemanticModel`].map(n => path.join(PBI, n));
  const existente = destinos.find(d => fs.existsSync(d));
  if (existente) {
    console.error(`Destino já existe (${existente}). Nada foi gravado.`);
    process.exit(1);
  }

  copiar(path.join(PBI, `${ORIGEM}.Report`), path.join(PBI, `${DESTINO}.Report`));
  copiar(path.join(PBI, `${ORIGEM}.SemanticModel`), path.join(PBI, `${DESTINO}.SemanticModel`));

  const pbip = JSON.parse(fs.readFileSync(path.join(PBI, `${ORIGEM}.pbip`), 'utf8'));
  pbip.artifacts = [{ report: { path: `${DESTINO}.Report` } }];
  fs.writeFileSync(path.join(PBI, `${DESTINO}.pbip`), JSON.stringify(pbip, null, 2) + '\n', 'utf8');

  editarJson(path.join(PBI, `${DESTINO}.Report`, 'definition.pbir'), j => {
    j.datasetReference.byPath.path = `../${DESTINO}.SemanticModel`;
  });
  for (const tipo of ['Report', 'SemanticModel']) {
    editarJson(path.join(PBI, `${DESTINO}.${tipo}`, '.platform'), j => {
      j.metadata.displayName = DESTINO;
      j.config.logicalId = LOGICAL_ID[tipo];
    });
  }
  fs.writeFileSync(path.join(PBI, `${DESTINO}.SemanticModel`, 'definition', 'cultures', 'pt-BR.tmdl'),
    'cultureInfo pt-BR\n', 'utf8');
  ajustarTextos();
  limparFiltroPeriodo();

  console.log('Cópia criada:');
  destinos.forEach(d => console.log('  ' + path.relative(path.resolve(PBI, '..'), d)));
}

main();
