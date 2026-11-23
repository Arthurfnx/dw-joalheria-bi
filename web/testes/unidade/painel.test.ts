import { describe, expect, it } from "vitest";
import { validarUrlPainel } from "@/servidor/ambiente";

describe("RN-70: validação de PAINEL_URL", () => {
  it("trata ausência ou vazio como não configurado", () => {
    expect(validarUrlPainel(undefined)).toBeNull();
    expect(validarUrlPainel(null)).toBeNull();
    expect(validarUrlPainel("")).toBeNull();
    expect(validarUrlPainel("   ")).toBeNull();
  });

  it("aceita o link público do Grafana Cloud", () => {
    const url = "https://exemplo.grafana.net/public-dashboards/0123456789abcdef";
    expect(validarUrlPainel(url)).toBe(url);
    expect(validarUrlPainel(`  ${url}  `)).toBe(url);
    const comParametros = "https://pilha-teste.grafana.net/public-dashboards/abc123?orgId=1&refresh=5m";
    expect(validarUrlPainel(comParametros)).toBe(comParametros);
  });

  it.each([
    ["http", "http://exemplo.grafana.net/public-dashboards/abc123"],
    ["outro host", "https://exemplo.com/public-dashboards/abc123"],
    ["host que só contém grafana.net", "https://grafana.net.exemplo.com/public-dashboards/abc123"],
    ["host parecido", "https://exemplografana.net/public-dashboards/abc123"],
    ["domínio sem pilha", "https://grafana.net/public-dashboards/abc123"],
    ["caminho diferente", "https://exemplo.grafana.net/d/abc123/painel"],
    ["caminho sem token", "https://exemplo.grafana.net/public-dashboards/"],
    ["caminho que só começa parecido", "https://exemplo.grafana.net/public-dashboardsx/abc123"],
    ["porta", "https://exemplo.grafana.net:8443/public-dashboards/abc123"],
    ["credenciais", "https://usuario@exemplo.grafana.net/public-dashboards/abc123"],
    ["host real escondido por @", "https://exemplo.grafana.net@exemplo.com/public-dashboards/abc123"],
    ["outro esquema", "javascript:alert(1)//https://exemplo.grafana.net/public-dashboards/abc123"],
    ["endereço dentro de parâmetro", "https://exemplo.com/?u=https://exemplo.grafana.net/public-dashboards/abc123"],
  ])("recusa %s", (_caso, valor) => {
    expect(validarUrlPainel(valor)).toBeNull();
  });
});
