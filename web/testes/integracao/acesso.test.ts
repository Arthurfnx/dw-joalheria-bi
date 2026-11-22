// Critérios de aceite 4 a 8: login, bloqueio, hash, troca obrigatória e sessão.

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroCredenciais, ErroPermissao, ErroValidacao, MENSAGEM_CREDENCIAIS_INVALIDAS } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { hashToken } from "@/servidor/seguranca/token";
import { entrar, LIMITE_FALHAS_LOGIN, sair, trocarSenha, validarSessao } from "@/servidor/servicos/acesso";
import { listarUsuarios, criarUsuario, desativarUsuario, redefinirSenha } from "@/servidor/servicos/usuarios";
import {
  conectarComoAplicacao,
  criarAdministradorDeTeste,
  criarUsuarioPronto,
  nomeUnico,
  recriarBancoDeTeste,
  SENHA_DEFINITIVA,
  SENHA_PADRAO,
} from "../apoio/banco";

let bd: Bd;
let admin: Ator;

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  admin = (await criarAdministradorDeTeste(bd)).ator;
});

afterAll(async () => {
  await bd?.destroy();
});

async function mensagemDoErro(promessa: Promise<unknown>): Promise<string> {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ErroCredenciais);
  return (erro as Error).message;
}

describe("RN-01: login", () => {
  it("credenciais corretas abrem sessão e levam à tela inicial", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const { token, ator } = await entrar(bd, { login: vendedor.login, senha: vendedor.senha });
    expect(ator.deveTrocarSenha).toBe(false);
    expect(await validarSessao(bd, token)).toMatchObject({ id: ator.id, perfil: "VENDEDOR" });
  });

  it("login inexistente, senha errada e usuário inativo produzem a mesma mensagem", async () => {
    const ativo = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const inativo = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await desativarUsuario(bd, admin, inativo.ator.id);

    const mensagens = [
      await mensagemDoErro(entrar(bd, { login: "nao.existe", senha: "qualquer-coisa" })),
      await mensagemDoErro(entrar(bd, { login: ativo.login, senha: "senha-errada-000" })),
      await mensagemDoErro(entrar(bd, { login: inativo.login, senha: inativo.senha })),
      await mensagemDoErro(entrar(bd, { login: "", senha: "" })),
    ];
    expect(new Set(mensagens)).toEqual(new Set([MENSAGEM_CREDENCIAIS_INVALIDAS]));
  });

  it("o login é comparado sem diferenciar maiúsculas", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await expect(entrar(bd, { login: ` ${vendedor.login.toUpperCase()} `, senha: vendedor.senha })).resolves.toBeTruthy();
  });
});

describe("RN-02: bloqueio temporário", () => {
  it(`depois de ${LIMITE_FALHAS_LOGIN} falhas, a tentativa seguinte é recusada mesmo com a senha correta`, async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    for (let i = 0; i < LIMITE_FALHAS_LOGIN; i++) {
      await expect(entrar(bd, { login: vendedor.login, senha: "senha-errada-000" })).rejects.toBeInstanceOf(
        ErroCredenciais,
      );
    }
    await expect(entrar(bd, { login: vendedor.login, senha: vendedor.senha })).rejects.toBeInstanceOf(ErroCredenciais);

    const usuario = await bd
      .selectFrom("app.usuario")
      .select(sql<number>`extract(epoch from bloqueado_ate - now())`.as("segundos"))
      .where("id", "=", vendedor.ator.id)
      .executeTakeFirstOrThrow();
    // Bloqueio de 15 minutos, contados da quinta falha.
    expect(Number(usuario.segundos)).toBeGreaterThan(14 * 60);
    expect(Number(usuario.segundos)).toBeLessThanOrEqual(15 * 60);

    // Passado o prazo, o login volta a funcionar.
    await bd
      .updateTable("app.usuario")
      .set({ bloqueado_ate: sql<Date>`now() - interval '1 second'` })
      .where("id", "=", vendedor.ator.id)
      .execute();
    await expect(entrar(bd, { login: vendedor.login, senha: vendedor.senha })).resolves.toBeTruthy();
  });

  it("um login correto zera a contagem de falhas", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    for (let i = 0; i < LIMITE_FALHAS_LOGIN - 1; i++) {
      await expect(entrar(bd, { login: vendedor.login, senha: "senha-errada-000" })).rejects.toThrow();
    }
    await entrar(bd, { login: vendedor.login, senha: vendedor.senha });
    // Mais quatro falhas não bloqueiam, porque a contagem recomeçou.
    for (let i = 0; i < LIMITE_FALHAS_LOGIN - 1; i++) {
      await expect(entrar(bd, { login: vendedor.login, senha: "senha-errada-000" })).rejects.toThrow();
    }
    await expect(entrar(bd, { login: vendedor.login, senha: vendedor.senha })).resolves.toBeTruthy();
  });
});

describe("RN-03: senha só como hash Argon2id", () => {
  it("grava apenas o hash Argon2id e nenhuma linha da auditoria contém senha ou hash", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await redefinirSenha(bd, admin, { id: vendedor.ator.id, senha: "senha-provisoria-9" });

    const { senha_hash } = await bd
      .selectFrom("app.usuario")
      .select("senha_hash")
      .where("id", "=", vendedor.ator.id)
      .executeTakeFirstOrThrow();
    expect(senha_hash.startsWith("$argon2id$")).toBe(true);
    expect(senha_hash).not.toContain("senha-provisoria-9");

    const todosOsHashes = (await bd.selectFrom("app.usuario").select("senha_hash").execute()).map((u) => u.senha_hash);
    const auditoria = await sql<{ texto: string }>`
      select coalesce(dados_antes::text, '') || ' ' || coalesce(dados_depois::text, '') as texto from app.auditoria
    `.execute(bd);
    expect(auditoria.rows.length).toBeGreaterThan(0);
    for (const { texto } of auditoria.rows) {
      for (const segredo of [SENHA_PADRAO, SENHA_DEFINITIVA, "senha-provisoria-9", "senha-errada-000", "$argon2"]) {
        expect(texto).not.toContain(segredo);
      }
      for (const h of todosOsHashes) expect(texto).not.toContain(h);
      expect(texto).not.toMatch(/senha_hash|"senha"/);
    }
  });
});

describe("RN-04: troca obrigatória no primeiro acesso", () => {
  it("usuário recém-criado é levado à troca e não usa outra operação antes de trocar", async () => {
    const login = nomeUnico("novo");
    // Um administrador recém-criado, para provar que nem o perfil mais alto passa sem trocar.
    await criarUsuario(bd, admin, { nome: "Novo Admin", login, perfil: "ADMINISTRADOR", senha: SENHA_PADRAO });
    const { token, ator } = await entrar(bd, { login, senha: SENHA_PADRAO });
    expect(ator.deveTrocarSenha).toBe(true);
    expect((await validarSessao(bd, token))?.deveTrocarSenha).toBe(true);

    await expect(listarUsuarios(bd, ator)).rejects.toBeInstanceOf(ErroPermissao);

    await expect(
      trocarSenha(bd, ator, { senhaAtual: "errada-errada", novaSenha: SENHA_DEFINITIVA, confirmacao: SENHA_DEFINITIVA }),
    ).rejects.toBeInstanceOf(ErroValidacao);

    await trocarSenha(bd, ator, { senhaAtual: SENHA_PADRAO, novaSenha: SENHA_DEFINITIVA, confirmacao: SENHA_DEFINITIVA });
    const depois = await validarSessao(bd, token);
    expect(depois?.deveTrocarSenha).toBe(false);
    await expect(listarUsuarios(bd, depois!)).resolves.toBeInstanceOf(Array);
  });

  it("depois de redefinida pelo administrador, a senha precisa ser trocada de novo", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await redefinirSenha(bd, admin, { id: vendedor.ator.id, senha: "senha-provisoria-2" });
    const { ator } = await entrar(bd, { login: vendedor.login, senha: "senha-provisoria-2" });
    expect(ator.deveTrocarSenha).toBe(true);
  });
});

describe("RN-05: sessão", () => {
  it("o token não é guardado no banco, só o seu hash", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const linhas = await bd.selectFrom("app.sessao").select("token_hash").execute();
    expect(linhas.some((l) => l.token_hash === vendedor.token)).toBe(false);
    expect(linhas.some((l) => l.token_hash === hashToken(vendedor.token))).toBe(true);
  });

  it("sair revoga a sessão", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await sair(bd, vendedor.token);
    expect(await validarSessao(bd, vendedor.token)).toBeNull();
  });

  it("desativar o usuário revoga todas as sessões dele", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const outra = await entrar(bd, { login: vendedor.login, senha: vendedor.senha });
    await desativarUsuario(bd, admin, vendedor.ator.id);
    expect(await validarSessao(bd, vendedor.token)).toBeNull();
    expect(await validarSessao(bd, outra.token)).toBeNull();
    const abertas = await bd
      .selectFrom("app.sessao")
      .select("token_hash")
      .where("usuario_id", "=", vendedor.ator.id)
      .where("revogada_em", "is", null)
      .execute();
    expect(abertas).toHaveLength(0);
  });

  it("redefinir a senha revoga todas as sessões do usuário", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const outra = await entrar(bd, { login: vendedor.login, senha: vendedor.senha });
    await redefinirSenha(bd, admin, { id: vendedor.ator.id, senha: "senha-provisoria-3" });
    expect(await validarSessao(bd, vendedor.token)).toBeNull();
    expect(await validarSessao(bd, outra.token)).toBeNull();
  });

  it("sessão sem uso por mais de 8 horas expira", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    await bd
      .updateTable("app.sessao")
      .set({ ultimo_uso_em: sql<Date>`now() - interval '8 hours 1 minute'` })
      .where("token_hash", "=", hashToken(vendedor.token))
      .execute();
    expect(await validarSessao(bd, vendedor.token)).toBeNull();
  });

  it("sessão com mais de 7 dias expira, mesmo em uso", async () => {
    const vendedor = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    const { expira } = await bd
      .selectFrom("app.sessao")
      .select(sql<number>`extract(epoch from expira_em - criada_em)`.as("expira"))
      .where("token_hash", "=", hashToken(vendedor.token))
      .executeTakeFirstOrThrow();
    expect(Number(expira)).toBe(7 * 24 * 60 * 60);

    await bd
      .updateTable("app.sessao")
      .set({ expira_em: sql<Date>`now() - interval '1 second'` })
      .where("token_hash", "=", hashToken(vendedor.token))
      .execute();
    expect(await validarSessao(bd, vendedor.token)).toBeNull();
  });

  it("token desconhecido ou ausente não abre sessão", async () => {
    expect(await validarSessao(bd, "token-inventado")).toBeNull();
    expect(await validarSessao(bd, undefined)).toBeNull();
  });
});
