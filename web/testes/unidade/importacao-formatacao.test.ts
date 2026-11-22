import { describe, expect, it } from "vitest";
import { chaveDaDescricao, GRAFIAS_CATEGORIA, normalizarChave } from "@/servidor/importacao/categorias";
import { formatarData, formatarDecimal, formatarReais } from "@/web/formatacao";

describe("RN-93: grafias de categoria", () => {
  it("normaliza acento, caixa e espaços", () => {
    expect(normalizarChave("  Cordão ")).toBe("CORDAO");
    expect(normalizarChave("Relógio")).toBe("RELOGIO");
    expect(chaveDaDescricao("BINCO argola de teste")).toBe("BINCO");
  });

  it("variações observadas apontam para a mesma categoria", () => {
    for (const grafia of ["BRINCO", "BINCO", "BRNCO", "BTINCO"]) expect(GRAFIAS_CATEGORIA[grafia]).toBe("Brinco");
    for (const grafia of ["PULSEIRA", "PULEIRA", "PULSERIA"]) expect(GRAFIAS_CATEGORIA[grafia]).toBe("Pulseira");
    expect(GRAFIAS_CATEGORIA[normalizarChave("Pintente")]).toBe("Pingente");
    expect(GRAFIAS_CATEGORIA[normalizarChave("Escapulário")]).toBe("Escapulário");
    // Palavra fora da tabela não é adivinhada.
    expect(GRAFIAS_CATEGORIA["TRIO"]).toBeUndefined();
  });
});

describe("Formatação sem ponto flutuante", () => {
  it("formata reais a partir do texto do banco", () => {
    expect(formatarReais("1234567.5")).toBe("R$ 1.234.567,50");
    expect(formatarReais("0.01")).toBe("R$ 0,01");
    expect(formatarReais(null)).toBe("—");
  });

  it("formata data de negócio sem fuso e decimais sem zeros à direita", () => {
    expect(formatarData("2026-01-02")).toBe("02/01/2026");
    expect(formatarDecimal("1.3330")).toBe("1,333");
    expect(formatarDecimal("200.0000")).toBe("200");
  });
});
