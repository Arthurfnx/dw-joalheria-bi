// Requisições que alteram dados só são aceitas da própria origem.

/**
 * Compara o cabeçalho Origin com o host que recebeu a requisição.
 * Origin ausente ou "null" é recusado: navegadores sempre o enviam em POST.
 */
export function mesmaOrigem(origin: string | null, host: string | null): boolean {
  if (!origin || origin === "null" || !host) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.host.toLowerCase() === host.trim().toLowerCase();
}

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * RN-05: cookie Secure fora do ambiente local. Em desenvolvimento, ou quando o
 * servidor de produção é aberto pelo próprio computador, o cookie dispensa HTTPS.
 */
export function cookieDeveSerSeguro(nodeEnv: string | undefined, host: string | null): boolean {
  if (nodeEnv !== "production") return false;
  const nome = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return !HOSTS_LOCAIS.has(nome);
}
