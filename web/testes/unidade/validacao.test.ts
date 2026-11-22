import { describe, expect, it } from "vitest";
import { sanitizarDados } from "@/servidor/auditoria";
import { ErroValidacao } from "@/servidor/erros";
import {
  esquemaCriarUsuario,
  esquemaFiltroAuditoria,
  esquemaId,
  esquemaNomeCadastro,
  esquemaTrocarSenha,
  validar,
} from "@/servidor/validacao";

const usuarioValido = { nome: "Maria", login: "maria", perfil: "VENDEDOR", senha: "0123456789" };

describe("Validação de entrada", () => {
  it("normaliza o login para minúsculas e sem espaços nas pontas", () => {
    expect(validar(esquemaCriarUsuario, { ...usuarioValido, login: "  Maria.Silva " }).login).toBe("maria.silva");
  });

  it.each(["ab", "maria silva", "joão", "a".repeat(41), ""])("recusa o login %j", (login) => {
    expect(() => validar(esquemaCriarUsuario, { ...usuarioValido, login })).toThrow(ErroValidacao);
  });

  it("RN-03: senha com menos de 10 caracteres é recusada", () => {
    expect(() => validar(esquemaCriarUsuario, { ...usuarioValido, senha: "123456789" })).toThrow(
      /pelo menos 10 caracteres/,
    );
    expect(validar(esquemaCriarUsuario, usuarioValido).senha).toBe("0123456789");
  });

  it("recusa perfil desconhecido e nome vazio", () => {
    expect(() => validar(esquemaCriarUsuario, { ...usuarioValido, perfil: "GERENTE" })).toThrow(/Perfil inválido/);
    expect(() => validar(esquemaCriarUsuario, { ...usuarioValido, nome: "   " })).toThrow(/Informe o nome/);
    expect(() => validar(esquemaCriarUsuario, { ...usuarioValido, nome: undefined })).toThrow(ErroValidacao);
  });

  it("nome de cadastro é aparado e limitado", () => {
    expect(validar(esquemaNomeCadastro, "  Ouro 18k ")).toBe("Ouro 18k");
    expect(() => validar(esquemaNomeCadastro, "")).toThrow(ErroValidacao);
    expect(() => validar(esquemaNomeCadastro, "x".repeat(81))).toThrow(ErroValidacao);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1".repeat(20)])("recusa o identificador %j", (id) => {
    expect(() => validar(esquemaId, id)).toThrow(ErroValidacao);
  });

  it("aceita identificador positivo", () => {
    expect(validar(esquemaId, " 42 ")).toBe("42");
    expect(validar(esquemaId, 7)).toBe("7");
  });

  it("troca de senha exige confirmação igual e senha nova diferente da atual", () => {
    const base = { senhaAtual: "senha-antiga-1", novaSenha: "senha-nova-123", confirmacao: "senha-nova-123" };
    expect(() => validar(esquemaTrocarSenha, base)).not.toThrow();
    expect(() => validar(esquemaTrocarSenha, { ...base, confirmacao: "outra-senha-1" })).toThrow(/confirmação/);
    expect(() =>
      validar(esquemaTrocarSenha, { ...base, novaSenha: base.senhaAtual, confirmacao: base.senhaAtual }),
    ).toThrow(/diferente da atual/);
  });

  it("filtro da auditoria aceita campos vazios e recusa período invertido ou data inválida", () => {
    expect(validar(esquemaFiltroAuditoria, { de: "", ate: "", usuarioId: "", entidade: "" })).toEqual({});
    expect(() => validar(esquemaFiltroAuditoria, { de: "2026-11-10", ate: "2026-11-01" })).toThrow(/anterior/);
    expect(() => validar(esquemaFiltroAuditoria, { de: "10/11/2026" })).toThrow(/Data inválida/);
    expect(() => validar(esquemaFiltroAuditoria, { entidade: "usuario; drop" })).toThrow(/Entidade inválida/);
  });
});

describe("RN-03: dados de auditoria nunca levam senha nem hash", () => {
  it("remove campos de senha, hash e token e mantém o indicador de troca", () => {
    expect(
      sanitizarDados({
        nome: "Maria",
        senha: "x",
        senha_hash: "$argon2id$...",
        novaSenha: "y",
        token_hash: "abc",
        deve_trocar_senha: true,
      }),
    ).toEqual({ nome: "Maria", deve_trocar_senha: true });
  });
});
