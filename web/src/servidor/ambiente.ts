// Leitura das variáveis de ambiente que a aplicação usa (especificação, seção 4.5).

const SUFIXO_HOST_PAINEL = ".grafana.net";
const PREFIXO_CAMINHO_PAINEL = "/public-dashboards/";

/**
 * RN-70: o endereço do painel só é aceito no formato do link público do
 * Grafana Cloud, https://<pilha>.grafana.net/public-dashboards/<token>, sem
 * porta nem credenciais. Qualquer outro valor equivale a "não configurado".
 */
export function validarUrlPainel(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto.startsWith("https://")) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  // Confere o destino que o navegador vai usar, não só o texto digitado.
  if (url.protocol !== "https:" || url.port !== "") return null;
  if (url.username !== "" || url.password !== "") return null;
  const host = url.hostname;
  if (!host.endsWith(SUFIXO_HOST_PAINEL) || host.length <= SUFIXO_HOST_PAINEL.length) return null;
  if (!url.pathname.startsWith(PREFIXO_CAMINHO_PAINEL) || url.pathname.length <= PREFIXO_CAMINHO_PAINEL.length) {
    return null;
  }
  return url.toString();
}

export function urlPainel(): string | null {
  return validarUrlPainel(process.env.PAINEL_URL);
}

export function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`A variável de ambiente ${nome} não está definida. Veja web/.env.example.`);
  }
  return valor;
}
