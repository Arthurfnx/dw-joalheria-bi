// npm run importar:planilhas -- --folheados <XLSX> --ouro <XLSX do CLS> --login <administrador>
//
// Importa os dados reais uma única vez, num banco sem produtos (RN-101), numa
// única transação (RN-102). Os arquivos são abertos somente para leitura.
// O terminal mostra só contagens e motivos agrupados (RN-104): nenhuma
// descrição, nome de pessoa ou linha individual.

import path from "node:path";
import { parseArgs } from "node:util";
import ExcelJS from "exceljs";
import { carregarEnv } from "./carregar-env";
import { variavelObrigatoria } from "../src/servidor/ambiente";
import { criarBd, nomeDoBanco } from "../src/servidor/bd/conexao";
import { lerCls, lerFolheados, lerRamon } from "../src/servidor/importacao/leitura";
import { importarPlanilhas } from "../src/servidor/servicos/importacao";

async function abrir(caminho: string): Promise<ExcelJS.Workbook> {
  const planilha = new ExcelJS.Workbook();
  await planilha.xlsx.readFile(caminho);
  return planilha;
}

async function principal(): Promise<void> {
  carregarEnv();
  const { values } = parseArgs({
    options: {
      folheados: { type: "string" },
      ouro: { type: "string" },
      login: { type: "string" },
    },
  });
  if (!values.folheados || !values.ouro || !values.login) {
    throw new Error("Uso: npm run importar:planilhas -- --folheados <XLSX> --ouro <XLSX do CLS> --login <administrador>");
  }

  const url = variavelObrigatoria("DATABASE_URL");
  const nomeFolheados = path.basename(values.folheados);
  const nomeOuro = path.basename(values.ouro);
  const [folheados, ouro] = await Promise.all([abrir(values.folheados), abrir(values.ouro)]);
  const linhas = [
    ...lerFolheados(folheados, nomeFolheados),
    ...lerRamon(folheados, nomeFolheados),
    ...lerCls(ouro, nomeOuro),
  ];

  console.log(`Banco: ${nomeDoBanco(url)}`);
  console.log(`Linhas lidas das planilhas: ${linhas.length}`);
  const bd = criarBd(url, 1);
  try {
    const r = await importarPlanilhas(bd, {
      login: values.login,
      arquivo: `${nomeFolheados} + ${nomeOuro}`,
      linhas,
    });
    console.log(`\nLote ${r.loteId} concluído.\n`);
    console.table(r.contagens);
    console.log("\nOcorrências por motivo:");
    console.table(r.ocorrenciasPorMotivo);
    const c = r.conferencia;
    console.log("\nConferência (RN-105):");
    console.log(`- lidas = importadas + rejeitadas em todas as abas: ${c.abasConferem ? "sim" : "NÃO"}`);
    console.log(`- soma dos saldos: ${c.somaSaldos}; peças em estoque e consignadas: ${c.pecasEmEstoqueEConsignadas}`);
    console.log(`- produtos com saldo diferente das movimentações: ${c.divergenciasDeSaldo}`);
    if (!c.abasConferem || c.somaSaldos !== c.pecasEmEstoqueEConsignadas || c.divergenciasDeSaldo !== 0) {
      process.exitCode = 1;
    }
  } finally {
    await bd.destroy();
  }
}

principal().catch((erro: unknown) => {
  console.error(`ERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
