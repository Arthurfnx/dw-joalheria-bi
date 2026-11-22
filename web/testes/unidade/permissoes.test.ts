import { describe, expect, it } from "vitest";
import { ErroPermissao } from "@/servidor/erros";
import { exigirPermissao, permissaoDaRota, PERMISSOES, temPermissao, type Ator } from "@/servidor/permissoes";

const ROTAS_RESTRITAS = [
  "/admin",
  "/admin/usuarios",
  "/admin/cadastros",
  "/admin/configuracoes",
  "/admin/auditoria",
  "/admin/qualquer-tela-nova",
  "/relatorios",
  "/admin/preco-ouro",
  "/admin/importacao",
  "/produtos/novo",
  "/produtos/42/editar",
  "/estoque/movimentar",
];

function ator(perfil: Ator["perfil"], deveTrocarSenha = false): Ator {
  return { id: "1", nome: "Teste", login: "teste", perfil, deveTrocarSenha };
}

describe("Matriz de permissões (especificação, seção 2)", () => {
  it("administrador tem todas as permissões da T01", () => {
    for (const p of PERMISSOES) expect(temPermissao("ADMINISTRADOR", p)).toBe(true);
  });

  it("vendedor entra, troca a própria senha, vê o início e consulta produtos, sem custos", () => {
    const permitidas = PERMISSOES.filter((p) => temPermissao("VENDEDOR", p));
    expect(permitidas.sort()).toEqual(["inicio.ver", "produtos.consultar", "senha.trocar", "vendas.consultar", "vendas.registrar"]);
    expect(temPermissao("VENDEDOR", "vendas.cancelar")).toBe(false);
    expect(temPermissao("VENDEDOR", "custos.ver")).toBe(false);
  });

  it("o vendedor abre a lista e o detalhe de produtos", () => {
    for (const rota of ["/produtos", "/produtos/42", "/vendas", "/vendas/nova", "/vendas/7"]) {
      expect(temPermissao("VENDEDOR", permissaoDaRota(rota)), rota).toBe(true);
    }
  });

  it("RN-06: vendedor recebe acesso negado em /admin, /relatorios, cadastro de produto e movimentação", () => {
    for (const rota of ROTAS_RESTRITAS) {
      expect(temPermissao("VENDEDOR", permissaoDaRota(rota)), rota).toBe(false);
      expect(temPermissao("ADMINISTRADOR", permissaoDaRota(rota)), rota).toBe(true);
    }
  });

  it("rotas comuns exigem apenas sessão", () => {
    for (const rota of ["/", "/acesso-negado", "/trocar-senha"]) {
      expect(permissaoDaRota(rota)).toBe("inicio.ver");
    }
    // Prefixo parecido não herda a permissão de outra rota.
    expect(permissaoDaRota("/relatoriosx")).toBe("inicio.ver");
  });

  it("exigirPermissao lança ErroPermissao para perfil sem acesso", () => {
    expect(() => exigirPermissao(ator("VENDEDOR"), "usuarios.gerenciar")).toThrow(ErroPermissao);
    expect(() => exigirPermissao(ator("ADMINISTRADOR"), "usuarios.gerenciar")).not.toThrow();
  });

  it("RN-04: com troca de senha pendente, só a troca é permitida, mesmo para o administrador", () => {
    const pendente = ator("ADMINISTRADOR", true);
    expect(() => exigirPermissao(pendente, "senha.trocar")).not.toThrow();
    for (const p of PERMISSOES.filter((p) => p !== "senha.trocar")) {
      expect(() => exigirPermissao(pendente, p)).toThrow(ErroPermissao);
    }
  });
});
