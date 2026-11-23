// Filtros dos gráficos da tela Relatórios: leitura da URL, validação contra
// as listas do Data Warehouse e montagem dos parâmetros das consultas.
// Dados de teste.

import { describe, expect, it } from "vitest";
import {
  descreverFiltros,
  FILTROS_TODOS,
  lerFiltros,
  parametrosConsulta,
  type OpcoesFiltro,
} from "@/web/filtros-relatorios";

const OPCOES: OpcoesFiltro = {
  materiais: ["Material A", "Material B"],
  tipos: ["Anel", "Brinco"],
  anos: ["2026", "2025"],
};

describe("filtros dos gráficos de Relatórios", () => {
  it("sem parâmetros na URL, todos os filtros ficam em Todos", () => {
    expect(lerFiltros({}, OPCOES)).toEqual(FILTROS_TODOS);
  });

  it("aceita valores que constam das listas do DW", () => {
    expect(lerFiltros({ material: "Material B", tipo: "Anel", ano: "2025" }, OPCOES)).toEqual({
      material: "Material B",
      tipo: "Anel",
      ano: "2025",
    });
  });

  it("valor desconhecido equivale a Todos", () => {
    expect(lerFiltros({ material: "Outro'; DROP TABLE x", tipo: "anel", ano: "1900" }, OPCOES)).toEqual(FILTROS_TODOS);
  });

  it("valor vazio (opção Todos do formulário) equivale a Todos", () => {
    expect(lerFiltros({ material: "", tipo: "", ano: "" }, OPCOES)).toEqual(FILTROS_TODOS);
  });

  it("parâmetro repetido usa só o primeiro valor", () => {
    expect(lerFiltros({ tipo: ["Brinco", "Anel"] }, OPCOES).tipo).toBe("Brinco");
  });

  it("ignora espaços nas pontas", () => {
    expect(lerFiltros({ ano: " 2026 " }, OPCOES).ano).toBe("2026");
  });

  it("monta os parâmetros na ordem material, tipo, ano, com null para Todos", () => {
    expect(parametrosConsulta(FILTROS_TODOS)).toEqual([null, null, null]);
    expect(parametrosConsulta({ material: "Material A", tipo: null, ano: "2025" })).toEqual(["Material A", null, 2025]);
  });

  it("valor desconhecido nunca chega aos parâmetros da consulta", () => {
    const filtros = lerFiltros({ material: "x", tipo: "y", ano: "abc" }, OPCOES);
    expect(parametrosConsulta(filtros)).toEqual([null, null, null]);
  });

  it("descreve os filtros ativos", () => {
    expect(descreverFiltros(FILTROS_TODOS)).toBe("todos os dados");
    expect(descreverFiltros({ material: "Material A", tipo: null, ano: "2026" })).toBe("material Material A, ano 2026");
  });
});
