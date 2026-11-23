import { describe, expect, it } from "vitest";
import { acoesRapidasDaInicio, atalhosDaInicio, itensDoMenu } from "@/web/menu";

describe("menu por perfil", () => {
  it("Administrador vê 'Cadastrar produto' logo depois de 'Produtos'", () => {
    const rotulos = itensDoMenu("ADMINISTRADOR").map((i) => i.rotulo);
    const posicao = rotulos.indexOf("Cadastrar produto");
    expect(posicao).toBeGreaterThan(0);
    expect(rotulos[posicao - 1]).toBe("Produtos");
    expect(itensDoMenu("ADMINISTRADOR").find((i) => i.rotulo === "Cadastrar produto")?.rota).toBe("/produtos/novo");
  });

  it("Vendedor não vê 'Cadastrar produto', mas continua vendo 'Produtos'", () => {
    const rotas = itensDoMenu("VENDEDOR").map((i) => i.rota);
    expect(rotas).toContain("/produtos");
    expect(rotas).not.toContain("/produtos/novo");
  });
});

describe("atalhos da tela Início", () => {
  it("Administrador: a grade não repete as rotas dos botões do topo", () => {
    const botoes = acoesRapidasDaInicio("ADMINISTRADOR").map((a) => a.rota);
    expect(botoes).toEqual(["/vendas/nova", "/produtos/novo"]);
    const cartoes = atalhosDaInicio("ADMINISTRADOR").map((a) => a.rota);
    expect(cartoes).not.toContain("/vendas/nova");
    expect(cartoes).not.toContain("/produtos/novo");
    expect(cartoes).not.toContain("/");
    expect(cartoes).toContain("/produtos");
    expect(cartoes).toContain("/vendas");
  });

  it("Vendedor: só o botão de Nova venda, e a grade não o repete", () => {
    const botoes = acoesRapidasDaInicio("VENDEDOR").map((a) => a.rota);
    expect(botoes).toEqual(["/vendas/nova"]);
    const cartoes = atalhosDaInicio("VENDEDOR").map((a) => a.rota);
    expect(cartoes).not.toContain("/vendas/nova");
    expect(cartoes).not.toContain("/produtos/novo");
    expect(cartoes).toContain("/produtos");
  });

  it("a grade só exclui rotas que o perfil vê como botão", () => {
    for (const perfil of ["ADMINISTRADOR", "VENDEDOR"] as const) {
      const botoes = new Set(acoesRapidasDaInicio(perfil).map((a) => a.rota));
      const esperado = itensDoMenu(perfil).filter((i) => i.rota !== "/" && !botoes.has(i.rota));
      expect(atalhosDaInicio(perfil)).toEqual(esperado);
    }
  });
});
