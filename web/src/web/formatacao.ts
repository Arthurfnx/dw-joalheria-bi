// Datas no formato dia/mês/ano, no fuso de São Paulo (especificação, seção 5).

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export function formatarDataHora(momento: Date): string {
  return DATA_HORA.format(momento);
}

/** Data de negócio AAAA-MM-DD em dia/mês/ano, sem passar por fuso horário. */
export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Valor numeric (texto com ponto decimal) em reais. Formata o texto em vez de
 * convertê-lo em número, para o valor nunca passar por ponto flutuante.
 */
export function formatarReais(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const negativo = valor.startsWith("-");
  const [inteiro, decimal = ""] = valor.replace("-", "").split(".");
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}R$ ${milhares},${decimal.padEnd(2, "0").slice(0, 2)}`;
}

/** Decimal sem zeros à direita, com vírgula: "1.3330" vira "1,333". */
export function formatarDecimal(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return valor.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",");
}

export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
