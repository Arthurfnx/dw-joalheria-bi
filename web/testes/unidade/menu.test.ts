import { describe, expect, it } from "vitest";
import { itensDoMenu } from "@/web/menu";

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
