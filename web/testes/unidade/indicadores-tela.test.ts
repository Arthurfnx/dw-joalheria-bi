import { describe, expect, it } from "vitest";
import {
  descreverSerie,
  formatarPecas,
  formatarPercentual,
  marcasDoEixo,
  rotuloEixo,
  rotuloMes,
  rotuloMesLongo,
  serieEstoque,
  serieVendas,
} from "@/web/indicadores";

const meses = [
  { mes: "2026-10", pecasTotal: 3, valorTotal: "1234.50" },
  { mes: "2026-11", pecasTotal: 1, valorTotal: "0.00" },
];

describe("Dados dos gráficos de indicadores", () => {
  it("rótulos de mês abreviados e por extenso em português", () => {
    expect(rotuloMes("2026-01")).toBe("jan/26");
    expect(rotuloMes("2025-12")).toBe("dez/25");
    expect(rotuloMesLongo("2026-03")).toBe("março de 2026");
  });

  it("RN-114: a série de vendas tem uma única unidade, peças ou reais", () => {
    const pecas = serieVendas(meses, "PECAS");
    expect(pecas.unidade).toBe("PECAS");
    expect(pecas.pontos.map((p) => p.texto)).toEqual(["3 peças", "1 peça"]);
    const valor = serieVendas(meses, "VALOR");
    expect(valor.unidade).toBe("VALOR");
    expect(valor.pontos.map((p) => p.texto)).toEqual(["R$ 1.234,50", "R$ 0,00"]);
    expect(valor.pontos.every((p) => !p.texto.includes("peça"))).toBe(true);
    expect(pecas.pontos.every((p) => !p.texto.includes("R$"))).toBe(true);
  });

  it("RN-110: estoque sempre em peças", () => {
    const s = serieEstoque([{ nome: "Prata", pecas: 1200 }]);
    expect(s.unidade).toBe("PECAS");
    expect(s.pontos[0].texto).toBe("1.200 peças");
  });

  it("números e eixos formatados em português", () => {
    expect(formatarPecas(2454)).toBe("2.454 peças");
    expect(rotuloEixo(12500, "VALOR")).toMatch(/^R\$ 12,5\s?mil$/);
    expect(rotuloEixo(50, "PECAS")).toBe("50");
    expect(formatarPercentual(1, 3)).toBe("33,3%");
  });

  it("marcas do eixo cobrem o máximo com passos redondos", () => {
    expect(marcasDoEixo(0)).toEqual([0, 1]);
    expect(marcasDoEixo(9)).toEqual([0, 5, 10]);
    expect(marcasDoEixo(0.5)).toEqual([0, 1]);
    const m = marcasDoEixo(1234);
    expect(m[0]).toBe(0);
    expect(m.at(-1)!).toBeGreaterThanOrEqual(1234);
    expect(marcasDoEixo(3)).toEqual([0, 1, 2, 3]);
  });

  it("RN-115: descrição acessível com período, maior valor e total", () => {
    const d = descreverSerie(serieVendas(meses, "PECAS"), "tempo", "4 peças");
    expect(d).toBe("2 meses, de outubro de 2026 a novembro de 2026. Maior: outubro de 2026, 3 peças. Total: 4 peças.");
  });
});
