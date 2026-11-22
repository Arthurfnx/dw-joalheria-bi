// Leitura das variáveis de ambiente que a aplicação usa (especificação, seção 4.5).

const PREFIXO_POWERBI = "https://app.powerbi.com/";

/**
 * RN-70: o endereço do relatório só é aceito se começar por
 * https://app.powerbi.com/. Qualquer outro valor equivale a "não configurado".
 */
export function validarUrlPowerBi(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto.startsWith(PREFIXO_POWERBI)) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  // O prefixo textual não basta sozinho: confere também o destino que o navegador vai usar.
  if (url.protocol !== "https:" || url.hostname !== "app.powerbi.com" || url.port !== "") return null;
  if (url.username !== "" || url.password !== "") return null;
  return url.toString();
}

export function urlRelatorioPowerBi(): string | null {
  return validarUrlPowerBi(process.env.POWERBI_URL_RELATORIO);
}

export function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`A variável de ambiente ${nome} não está definida. Veja web/.env.example.`);
  }
  return valor;
}
