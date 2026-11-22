// RN-93: grafias de categoria observadas nas planilhas, normalizadas (sem
// acento, em maiúsculas). Só entram variações da mesma palavra; qualquer outra
// palavra vai para "A classificar", para o administrador revisar.
// Montada a partir da contagem das primeiras palavras das descrições
// (FOLHEADOS e RAMON) e dos valores da coluna CATEGORIA (CLS), em 2026-11-22.

export const CATEGORIA_A_CLASSIFICAR = "A classificar";

export const GRAFIAS_CATEGORIA: Readonly<Record<string, string>> = {
  BRINCO: "Brinco",
  BINCO: "Brinco",
  BRNCO: "Brinco",
  BTINCO: "Brinco",
  ANEL: "Anel",
  ALIANCA: "Aliança",
  PULSEIRA: "Pulseira",
  PULEIRA: "Pulseira",
  PULSERIA: "Pulseira",
  CORDAO: "Cordão",
  CORDAODE: "Cordão",
  PINGENTE: "Pingente",
  PINTENTE: "Pingente",
  CORRENTE: "Corrente",
  CORENTE: "Corrente",
  TORNOZELEIRA: "Tornozeleira",
  "CONJ.": "Conjunto",
  CONJ: "Conjunto",
  CONJUNTO: "Conjunto",
  BRACELETE: "Bracelete",
  COLAR: "Colar",
  BROCHE: "Broche",
  ESCAPULARIO: "Escapulário",
  RELOGIO: "Relógio",
  PIRCING: "Piercing",
  PIERCING: "Piercing",
};

/** Sem acento, em maiúsculas e sem espaços nas pontas. */
export function normalizarChave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

/** Primeira palavra da descrição, normalizada (FOLHEADOS e RAMON). */
export function chaveDaDescricao(descricao: string): string {
  return normalizarChave(descricao.trim().split(/\s+/)[0] ?? "");
}
