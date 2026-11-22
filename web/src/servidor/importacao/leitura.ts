// Leitura das planilhas (seção 6.1). Só extrai e limpa os valores das células;
// as regras de negócio (RN-90 a RN-105) ficam na função app.importar_lote.
// A coluna CLIENTE nunca é lida: o nome do cliente não é importado (RN-99).

import type ExcelJS from "exceljs";
import { chaveDaDescricao, normalizarChave } from "./categorias";

export type Fonte = "FOLHEADOS" | "RAMON" | "CLS";

export interface LinhaImportacao {
  fonte: Fonte;
  arquivo: string;
  aba: string;
  linha: number;
  codigo: string;
  descricao: string;
  chave_categoria: string;
  valor_compra: string | null;
  peso: string | null;
  tamanho: string | null;
  tamanho_original: string | null;
  indice: string | null;
  local_planilha: string | null;
  data_compra: string | null;
  data_compra_invalida: boolean;
  valor_venda: string | null;
  data_venda: string | null;
  data_venda_invalida: boolean;
}

export const ABA_FOLHEADOS = "FOLHEADOS";
export const ABA_RAMON = "RAMON - PEÇAS";
// Seção 6.1: FOLHEADOS vai até a linha 1543 (depois vêm os totais); em RAMON, da
// linha 288 em diante ficam o total e os pagamentos ao fornecedor, que não entram.
const PRIMEIRA_LINHA_DADOS = 3;
const ULTIMA_LINHA_FOLHEADOS = 1543;
const ULTIMA_LINHA_RAMON = 287;

export class ErroLeituraPlanilha extends Error {}

type ValorCelula = ExcelJS.CellValue;

/** Valor efetivo da célula: resultado da fórmula, texto rico ou hiperlink. */
function valorDe(v: ValorCelula): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  if ("result" in v) return v.result ?? null;
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  return null;
}

function texto(v: ValorCelula): string {
  const x = valorDe(v);
  if (x === null || x === undefined || x instanceof Date) return "";
  return String(x).trim();
}

/** Número como texto, para o banco converter em numeric sem passar por arredondamento de ponto flutuante na aplicação. */
function numero(v: ValorCelula): string | null {
  const x = valorDe(v);
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  if (typeof x === "string") {
    const semMoeda = x.trim().replace(/^R\$\s*/i, "");
    // Com vírgula, o ponto é separador de milhar ("1.234,56"); sem vírgula, é o decimal ("1.5").
    const limpo = semMoeda.includes(",") ? semMoeda.replace(/\./g, "").replace(",", ".") : semMoeda;
    if (/^-?\d+(\.\d+)?$/.test(limpo)) return limpo;
  }
  return null;
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Data da planilha. Datas do Excel chegam como Date em UTC. Número solto (o
 * serial 1 = 1899-12-31), data anterior a 1990 ou futura são inválidas.
 */
function data(v: ValorCelula): { data: string | null; invalida: boolean } {
  const x = valorDe(v);
  if (x === null || x === undefined || x === "") return { data: null, invalida: false };
  let iso: string | null = null;
  if (x instanceof Date && !Number.isNaN(x.getTime())) {
    iso = x.toISOString().slice(0, 10);
  } else if (typeof x === "string") {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(x.trim());
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso || iso < "1990-01-01" || iso > hojeSaoPaulo() || Number.isNaN(Date.parse(iso))) {
    return { data: null, invalida: true };
  }
  return { data: iso, invalida: false };
}

/** Tamanho: "T16", "T 16" e 16 viram "16"; o texto original fica guardado à parte. */
function tamanho(v: ValorCelula): { tamanho: string | null; original: string | null } {
  const x = valorDe(v);
  if (x === null || x === undefined) return { tamanho: null, original: null };
  const original = typeof x === "number" ? String(x).replace(".", ",") : String(x).trim();
  if (original === "") return { tamanho: null, original: null };
  const normalizado = original.replace(/^T\s*/i, "").trim();
  return { tamanho: normalizado === "" ? original : normalizado, original };
}

function linhaVazia(row: ExcelJS.Row, colunaCodigo: number, colunaDescricao: number): boolean {
  return texto(row.getCell(colunaCodigo).value) === "" && texto(row.getCell(colunaDescricao).value) === "";
}

function aba(planilha: ExcelJS.Workbook, nome: string): ExcelJS.Worksheet {
  const ws = planilha.getWorksheet(nome);
  if (!ws) throw new ErroLeituraPlanilha(`A aba "${nome}" não foi encontrada na planilha.`);
  return ws;
}

/** Aba FOLHEADOS: A código, B descrição, C valor de compra, D peso, E tamanho, F índice, G local, H data da compra, I valor de venda, J data da venda. */
export function lerFolheados(planilha: ExcelJS.Workbook, arquivo: string): LinhaImportacao[] {
  const ws = aba(planilha, ABA_FOLHEADOS);
  const linhas: LinhaImportacao[] = [];
  const ultima = Math.min(ws.rowCount, ULTIMA_LINHA_FOLHEADOS);
  for (let n = PRIMEIRA_LINHA_DADOS; n <= ultima; n++) {
    const r = ws.getRow(n);
    if (linhaVazia(r, 1, 2)) continue;
    const descricao = texto(r.getCell(2).value);
    const t = tamanho(r.getCell(5).value);
    const compra = data(r.getCell(8).value);
    const venda = data(r.getCell(10).value);
    linhas.push({
      fonte: "FOLHEADOS",
      arquivo,
      aba: ABA_FOLHEADOS,
      linha: n,
      codigo: texto(r.getCell(1).value),
      descricao,
      chave_categoria: chaveDaDescricao(descricao),
      valor_compra: numero(r.getCell(3).value),
      peso: numero(r.getCell(4).value),
      tamanho: t.tamanho,
      tamanho_original: t.original,
      indice: numero(r.getCell(6).value),
      local_planilha: texto(r.getCell(7).value) || null,
      data_compra: compra.data,
      data_compra_invalida: compra.invalida,
      valor_venda: numero(r.getCell(9).value),
      data_venda: venda.data,
      data_venda_invalida: venda.invalida,
    });
  }
  return linhas;
}

/**
 * Aba RAMON - PEÇAS: A código, B descrição, C valor de compra, F data da venda,
 * G tamanho, I valor vendido. Não tem local, data de compra nem índice de preço.
 */
export function lerRamon(planilha: ExcelJS.Workbook, arquivo: string): LinhaImportacao[] {
  const ws = aba(planilha, ABA_RAMON);
  const linhas: LinhaImportacao[] = [];
  const ultima = Math.min(ws.rowCount, ULTIMA_LINHA_RAMON);
  for (let n = PRIMEIRA_LINHA_DADOS; n <= ultima; n++) {
    const r = ws.getRow(n);
    if (linhaVazia(r, 1, 2)) continue;
    const descricao = texto(r.getCell(2).value);
    const t = tamanho(r.getCell(7).value);
    const venda = data(r.getCell(6).value);
    linhas.push({
      fonte: "RAMON",
      arquivo,
      aba: ABA_RAMON,
      linha: n,
      codigo: texto(r.getCell(1).value),
      descricao,
      chave_categoria: chaveDaDescricao(descricao),
      valor_compra: numero(r.getCell(3).value),
      peso: null,
      tamanho: t.tamanho,
      tamanho_original: t.original,
      indice: null,
      local_planilha: null,
      data_compra: null,
      data_compra_invalida: false,
      valor_venda: numero(r.getCell(9).value),
      data_venda: venda.data,
      data_venda_invalida: venda.invalida,
    });
  }
  return linhas;
}

/** CLS (primeira aba, cabeçalho na linha 1): A código, B categoria, C descrição, D peso, E Ø, F Ind Preço. */
export function lerCls(planilha: ExcelJS.Workbook, arquivo: string): LinhaImportacao[] {
  const ws = planilha.worksheets[0];
  if (!ws) throw new ErroLeituraPlanilha("O arquivo do CLS não tem nenhuma aba.");
  const linhas: LinhaImportacao[] = [];
  for (let n = 2; n <= ws.rowCount; n++) {
    const r = ws.getRow(n);
    if (linhaVazia(r, 1, 3)) continue;
    const t = tamanho(r.getCell(5).value);
    linhas.push({
      fonte: "CLS",
      arquivo,
      aba: ws.name,
      linha: n,
      codigo: texto(r.getCell(1).value),
      descricao: texto(r.getCell(3).value),
      chave_categoria: normalizarChave(texto(r.getCell(2).value)),
      valor_compra: null,
      peso: numero(r.getCell(4).value),
      tamanho: t.tamanho,
      tamanho_original: t.original,
      indice: numero(r.getCell(6).value),
      local_planilha: null,
      data_compra: null,
      data_compra_invalida: false,
      valor_venda: null,
      data_venda: null,
      data_venda_invalida: false,
    });
  }
  return linhas;
}
