import { describe, expect, it } from "vitest";
import { validarUrlPowerBi } from "@/servidor/ambiente";

describe("RN-70: validação de POWERBI_URL_RELATORIO", () => {
  it("sem valor, o relatório fica não configurado", () => {
    expect(validarUrlPowerBi(undefined)).toBeNull();
    expect(validarUrlPowerBi(null)).toBeNull();
    expect(validarUrlPowerBi("")).toBeNull();
    expect(validarUrlPowerBi("   ")).toBeNull();
  });

  it("aceita endereço que começa por https://app.powerbi.com/", () => {
    const url = "https://app.powerbi.com/view?r=eyJrIjoiZmljdGljaW8ifQ%3D%3D";
    expect(validarUrlPowerBi(url)).toBe(url);
    expect(validarUrlPowerBi(`  ${url}  `)).toBe(url);
  });

  it.each([
    "http://app.powerbi.com/view?r=abc",
    "https://app.powerbi.com.exemplo.com/view?r=abc",
    "https://app.powerbi.com",
    "https://exemplo.com/?u=https://app.powerbi.com/",
    "https://APP.powerbi.com/view?r=abc",
    "javascript:alert(1)//https://app.powerbi.com/",
    "https://app.powerbi.com:8443/view?r=abc",
    "https://app.powerbi.com@exemplo.com/view",
  ])("recusa %s", (valor) => {
    expect(validarUrlPowerBi(valor)).toBeNull();
  });
});
