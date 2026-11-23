// Drill-down e roll-up da tela Relatórios: links que mudam os filtros da URL,
// trilhas de navegação e as consultas dos níveis Ano e Produto. Dados de teste.

import { describe, expect, it } from "vitest";
import {
  FILTROS_TODOS,
  trilhaData,
  trilhaProduto,
  urlDescer,
  urlRelatorios,
  type FiltrosRelatorio,
} from "@/web/filtros-relatorios";
import { produtosVendidos, somarReais, vendasPorAno, type ConsultorDw } from "@/servidor/servicos/relatorios-dw";

const TUDO: FiltrosRelatorio = { material: "Material A", tipo: "Anel", ano: "2025" };

function consultorFalso(rows: object[]): ConsultorDw & { chamadas: unknown[][] } {
  const chamadas: unknown[][] = [];
  return {
    chamadas,
    async query<T extends object>(_sql: string, parametros?: unknown[]) {
      chamadas.push(parametros ?? []);
      return { rows: rows as T[] };
    },
  };
}

describe("links de drill-down", () => {
  it("sem filtros, o endereço é a tela pura", () => {
    expect(urlRelatorios(FILTROS_TODOS)).toBe("/relatorios");
  });

  it("descer em material preserva Tipo e Ano", () => {
    const f = { material: null, tipo: null, ano: "2025" };
    expect(urlDescer(f, "material", "Material B")).toBe("/relatorios?material=Material+B&ano=2025");
  });

  it("descer em tipo preserva material e ano", () => {
    const f = { material: "Material A", tipo: null, ano: "2025" };
    expect(urlDescer(f, "tipo", "Anel")).toBe("/relatorios?material=Material+A&tipo=Anel&ano=2025");
  });

  it("descer em ano preserva material e tipo", () => {
    const f = { material: "Material A", tipo: "Anel", ano: null };
    expect(urlDescer(f, "ano", "2024")).toBe("/relatorios?material=Material+A&tipo=Anel&ano=2024");
  });

  it("codifica caracteres especiais do valor", () => {
    expect(urlDescer(FILTROS_TODOS, "material", "Ouro & Prata")).toBe("/relatorios?material=Ouro+%26+Prata");
  });
});

describe("trilhas de navegação (roll-up)", () => {
  it("sem filtros, a trilha de produto só tem o nível atual, sem link", () => {
    expect(trilhaProduto(FILTROS_TODOS)).toEqual([{ rotulo: "Todos os materiais", href: null }]);
  });

  it("cada nível de produto remove os níveis abaixo e mantém o Ano", () => {
    expect(trilhaProduto(TUDO)).toEqual([
      { rotulo: "Todos os materiais", href: "/relatorios?ano=2025" },
      { rotulo: "Material A", href: "/relatorios?material=Material+A&ano=2025" },
      { rotulo: "Anel", href: null },
    ]);
  });

  it("o nível de data remove o Ano e mantém material e tipo", () => {
    expect(trilhaData(TUDO)).toEqual([
      { rotulo: "Todos os anos", href: "/relatorios?material=Material+A&tipo=Anel" },
      { rotulo: "2025", href: null },
    ]);
    expect(trilhaData(FILTROS_TODOS)).toEqual([{ rotulo: "Todos os anos", href: null }]);
  });
});

describe("consultas dos níveis Ano e Produto", () => {
  it("soma reais em centavos, sem ponto flutuante", () => {
    expect(somarReais("0.10", "0.20")).toBe("0.30");
    expect(somarReais("1234.56", "0.00")).toBe("1234.56");
    expect(somarReais("0.01", "0.00")).toBe("0.01");
  });

  it("agrupa os trimestres por ano e soma os totais do ano", async () => {
    const dw = consultorFalso([
      { ano: "2024", trimestre: 1, pecas: 2, receita: "10.10" },
      { ano: "2024", trimestre: 2, pecas: 0, receita: "0.00" },
      { ano: "2024", trimestre: 3, pecas: 1, receita: "5.05" },
      { ano: "2024", trimestre: 4, pecas: 3, receita: "0.00" },
      { ano: "2025", trimestre: 1, pecas: 1, receita: "1.00" },
      { ano: "2025", trimestre: 2, pecas: 0, receita: "0.00" },
      { ano: "2025", trimestre: 3, pecas: 0, receita: "0.00" },
      { ano: "2025", trimestre: 4, pecas: 0, receita: "0.00" },
    ]);
    const anos = await vendasPorAno(dw, { ...TUDO, ano: null });
    expect(anos.map((a) => [a.ano, a.pecas, a.receita, a.trimestres.length])).toEqual([
      ["2024", 6, "15.15", 4],
      ["2025", 1, "1.00", 4],
    ]);
    expect(dw.chamadas[0]).toEqual(["Material A", "Anel", null]);
  });

  it("produtos vendidos: parâmetros com limite e total antes do limite", async () => {
    const dw = consultorFalso([
      { codigo: "T-1", descricao: "Produto de teste 1", pecas: 2, receita: "20.00", total: 3 },
      { codigo: "T-2", descricao: "Produto de teste 2", pecas: 1, receita: "5.00", total: 3 },
    ]);
    const r = await produtosVendidos(dw, TUDO, 2);
    expect(r.total).toBe(3);
    expect(r.linhas).toEqual([
      { codigo: "T-1", descricao: "Produto de teste 1", pecas: 2, receita: "20.00" },
      { codigo: "T-2", descricao: "Produto de teste 2", pecas: 1, receita: "5.00" },
    ]);
    expect(dw.chamadas[0]).toEqual(["Material A", "Anel", 2025, 2]);
  });

  it("sem vendas, produtos vendidos fica vazio com total zero", async () => {
    expect(await produtosVendidos(consultorFalso([]), TUDO)).toEqual({ total: 0, linhas: [] });
  });
});
