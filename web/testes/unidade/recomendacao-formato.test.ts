import { describe, expect, it } from "vitest";
import { recomendarFormato } from "@/servidor/recomendacao-formato";

describe("Recomendação do formato (RN-111)", () => {
  it("RN-111: série temporal → linha, pela tendência, qualquer que seja o número de meses", () => {
    for (const n of [1, 5, 24]) {
      const r = recomendarFormato("SERIE_TEMPORAL", n);
      expect(r.formato).toBe("LINHA");
      expect(r.motivo).toMatch(/tendência/);
    }
  });

  it("RN-111: comparação com mais de 5 itens → barras ordenadas", () => {
    const r = recomendarFormato("COMPARACAO", 12);
    expect(r.formato).toBe("BARRAS");
    expect(r.motivo).toMatch(/barras ordenadas/i);
    expect(r.motivo).toContain("12");
  });

  it("RN-111: comparação com até 5 itens → rosca", () => {
    for (const n of [1, 3, 5]) {
      const r = recomendarFormato("COMPARACAO", n);
      expect(r.formato).toBe("ROSCA");
      expect(r.motivo).toMatch(/participação/);
    }
  });

  it("RN-111: composição com até 5 partes → rosca, pela participação no todo", () => {
    for (const n of [1, 2, 5]) {
      const r = recomendarFormato("COMPOSICAO", n);
      expect(r.formato).toBe("ROSCA");
      expect(r.motivo).toMatch(/participação de cada parte no todo/);
    }
  });

  it("RN-111: composição com mais de 5 partes → barras", () => {
    const r = recomendarFormato("COMPOSICAO", 6);
    expect(r.formato).toBe("BARRAS");
    expect(r.motivo).toMatch(/comparar os tamanhos/);
  });

  it("RN-111: sem itens → tabela, com os valores exatos", () => {
    expect(recomendarFormato("COMPARACAO", 0).formato).toBe("TABELA");
    expect(recomendarFormato("COMPOSICAO", 0).motivo).toMatch(/Valores exatos/);
  });
});
