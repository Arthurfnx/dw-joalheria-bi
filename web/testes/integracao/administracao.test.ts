// Critérios de aceite 9, 10 e 12: permissões no servidor, último
// administrador, cadastros de domínio e registros de auditoria.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroNegocio, ErroPermissao } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { entrar } from "@/servidor/servicos/acesso";
import {
  criarCadastro,
  definirSituacaoCadastro,
  listarCadastros,
  listarOpcoesDeCadastro,
  renomearCadastro,
} from "@/servidor/servicos/cadastros";
import { alterarConfiguracao, listarConfiguracoes } from "@/servidor/servicos/configuracoes";
import { consultarAuditoria, opcoesFiltroAuditoria } from "@/servidor/servicos/consulta-auditoria";
import {
  criarAdministradorInicial,
  criarUsuario,
  desativarUsuario,
  editarUsuario,
  listarUsuarios,
  reativarUsuario,
  redefinirSenha,
} from "@/servidor/servicos/usuarios";
import {
  conectarComoAplicacao,
  criarAdministradorDeTeste,
  criarUsuarioPronto,
  nomeUnico,
  recriarBancoDeTeste,
  SENHA_PADRAO,
} from "../apoio/banco";

let bd: Bd;
let admin: Ator;
let vendedor: Ator;

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  admin = (await criarAdministradorDeTeste(bd)).ator;
  vendedor = (await criarUsuarioPronto(bd, admin, "VENDEDOR")).ator;
});

afterAll(async () => {
  await bd?.destroy();
});

describe("RN-06: o vendedor recebe acesso negado chamando as operações diretamente", () => {
  const operacoes: [string, () => Promise<unknown>][] = [
    ["listarUsuarios", () => listarUsuarios(bd, vendedor)],
    ["criarUsuario", () => criarUsuario(bd, vendedor, { nome: "X", login: "xxx", perfil: "VENDEDOR", senha: SENHA_PADRAO })],
    ["editarUsuario", () => editarUsuario(bd, vendedor, { id: admin.id, nome: "X", perfil: "VENDEDOR" })],
    ["desativarUsuario", () => desativarUsuario(bd, vendedor, admin.id)],
    ["reativarUsuario", () => reativarUsuario(bd, vendedor, admin.id)],
    ["redefinirSenha", () => redefinirSenha(bd, vendedor, { id: admin.id, senha: SENHA_PADRAO })],
    ["listarCadastros", () => listarCadastros(bd, vendedor)],
    ["criarCadastro", () => criarCadastro(bd, vendedor, { tipo: "material", nome: "Prata" })],
    ["renomearCadastro", () => renomearCadastro(bd, vendedor, { tipo: "material", id: "1", nome: "Y" })],
    ["definirSituacaoCadastro", () => definirSituacaoCadastro(bd, vendedor, { tipo: "material", id: "1", ativo: false })],
    ["listarConfiguracoes", () => listarConfiguracoes(bd, vendedor)],
    ["alterarConfiguracao", () => alterarConfiguracao(bd, vendedor, { chave: "dias_produto_parado", valor: "1" })],
    ["consultarAuditoria", () => consultarAuditoria(bd, vendedor, {})],
    ["opcoesFiltroAuditoria", () => opcoesFiltroAuditoria(bd, vendedor)],
  ];

  it.each(operacoes)("%s", async (_nome, operacao) => {
    await expect(operacao()).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("nada foi gravado pelas tentativas negadas", async () => {
    const usuario = await bd.selectFrom("app.usuario").select(["nome", "perfil", "ativo"]).where("id", "=", admin.id).executeTakeFirstOrThrow();
    expect(usuario).toEqual({ nome: "Administrador de Teste", perfil: "ADMINISTRADOR", ativo: true });
    const config = await bd.selectFrom("app.configuracao").select("valor").executeTakeFirstOrThrow();
    expect(config.valor).toBe("180");
  });
});

describe("RN-06: gestão de usuários", () => {
  it("o login é único", async () => {
    const login = nomeUnico("dup");
    await criarUsuario(bd, admin, { nome: "A", login, perfil: "VENDEDOR", senha: SENHA_PADRAO });
    await expect(
      criarUsuario(bd, admin, { nome: "B", login: login.toUpperCase(), perfil: "VENDEDOR", senha: SENHA_PADRAO }),
    ).rejects.toThrow("Já existe um usuário com este login.");
  });

  it("o último administrador ativo não pode ser desativado nem rebaixado", async () => {
    await expect(desativarUsuario(bd, admin, admin.id)).rejects.toThrow(/último administrador ativo/);
    await expect(editarUsuario(bd, admin, { id: admin.id, nome: "Adm", perfil: "VENDEDOR" })).rejects.toThrow(
      /último administrador ativo/,
    );

    // Com um segundo administrador ativo, o primeiro pode ser desativado.
    const segundo = await criarUsuarioPronto(bd, admin, "ADMINISTRADOR");
    await desativarUsuario(bd, segundo.ator, admin.id);
    await expect(desativarUsuario(bd, segundo.ator, segundo.ator.id)).rejects.toThrow(/último administrador ativo/);
    await reativarUsuario(bd, segundo.ator, admin.id);
    admin = (await entrar(bd, { login: (await loginDe(admin.id)), senha: SENHA_PADRAO })).ator;
  });

  it("o comando de primeiro administrador recusa quando já existe um administrador ativo", async () => {
    await expect(
      criarAdministradorInicial(bd, { nome: "Outro", login: nomeUnico("outro"), senha: SENHA_PADRAO }),
    ).rejects.toBeInstanceOf(ErroNegocio);
  });
});

async function loginDe(id: string): Promise<string> {
  return (await bd.selectFrom("app.usuario").select("login").where("id", "=", id).executeTakeFirstOrThrow()).login;
}

describe("RN-10 e RN-11: cadastros de domínio", () => {
  it("nomes duplicados são recusados sem diferenciar maiúsculas", async () => {
    await criarCadastro(bd, admin, { tipo: "material", nome: "Ouro 18k" });
    await expect(criarCadastro(bd, admin, { tipo: "material", nome: "OURO 18K" })).rejects.toThrow(
      "Já existe um material com este nome.",
    );
    await expect(criarCadastro(bd, admin, { tipo: "material", nome: "  ouro 18k  " })).rejects.toThrow(ErroNegocio);

    await criarCadastro(bd, admin, { tipo: "categoria", nome: "Anéis" });
    await expect(criarCadastro(bd, admin, { tipo: "categoria", nome: "ANÉIS" })).rejects.toThrow(
      "Já existe uma categoria com este nome.",
    );
  });

  it("renomear para um nome existente também é recusado", async () => {
    const id = await criarCadastro(bd, admin, { tipo: "material", nome: "Prata 925" });
    await expect(renomearCadastro(bd, admin, { tipo: "material", id, nome: "ouro 18K" })).rejects.toThrow(ErroNegocio);
    await renomearCadastro(bd, admin, { tipo: "material", id, nome: "Prata 950" });
  });

  it("a subcategoria fica ligada à sua categoria e o nome é único dentro dela", async () => {
    const colares = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Colares" });
    const brincos = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Brincos" });
    const id = await criarCadastro(bd, admin, { tipo: "subcategoria", nome: "Infantil", categoriaId: colares });
    // O mesmo nome é permitido em outra categoria.
    await criarCadastro(bd, admin, { tipo: "subcategoria", nome: "Infantil", categoriaId: brincos });
    await expect(
      criarCadastro(bd, admin, { tipo: "subcategoria", nome: "INFANTIL", categoriaId: colares }),
    ).rejects.toThrow("Já existe uma subcategoria com este nome nesta categoria.");
    await expect(criarCadastro(bd, admin, { tipo: "subcategoria", nome: "Sem categoria" })).rejects.toThrow(ErroNegocio);

    const sub = await bd.selectFrom("app.subcategoria").select("categoria_id").where("id", "=", id).executeTakeFirstOrThrow();
    expect(sub.categoria_id).toBe(colares);
  });

  it("um item desativado some das listas de escolha e continua na lista de administração", async () => {
    const material = await criarCadastro(bd, admin, { tipo: "material", nome: "Aço" });
    const categoria = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Pulseiras" });
    const sub = await criarCadastro(bd, admin, { tipo: "subcategoria", nome: "Masculina", categoriaId: categoria });

    let opcoes = await listarOpcoesDeCadastro(bd, vendedor);
    expect(opcoes.materiais.map((m) => m.id)).toContain(material);
    expect(opcoes.subcategorias.map((s) => s.id)).toContain(sub);

    await definirSituacaoCadastro(bd, admin, { tipo: "material", id: material, ativo: false });
    await definirSituacaoCadastro(bd, admin, { tipo: "categoria", id: categoria, ativo: false });

    opcoes = await listarOpcoesDeCadastro(bd, vendedor);
    expect(opcoes.materiais.map((m) => m.id)).not.toContain(material);
    expect(opcoes.categorias.map((c) => c.id)).not.toContain(categoria);
    // A subcategoria de uma categoria inativa também sai das escolhas.
    expect(opcoes.subcategorias.map((s) => s.id)).not.toContain(sub);

    await expect(
      criarCadastro(bd, admin, { tipo: "subcategoria", nome: "Nova", categoriaId: categoria }),
    ).rejects.toThrow(/inativa/);

    const todos = await listarCadastros(bd, admin);
    expect(todos.materiais.find((m) => m.id === material)?.ativo).toBe(false);

    await definirSituacaoCadastro(bd, admin, { tipo: "material", id: material, ativo: true });
    opcoes = await listarOpcoesDeCadastro(bd, vendedor);
    expect(opcoes.materiais.map((m) => m.id)).toContain(material);
  });
});

describe("Configurações", () => {
  it("valida e grava o parâmetro dias_produto_parado", async () => {
    await expect(alterarConfiguracao(bd, admin, { chave: "dias_produto_parado", valor: "0" })).rejects.toThrow();
    await expect(alterarConfiguracao(bd, admin, { chave: "dias_produto_parado", valor: "abc" })).rejects.toThrow();
    await expect(alterarConfiguracao(bd, admin, { chave: "chave_inventada", valor: "1" })).rejects.toThrow(
      /desconhecido/,
    );
    await alterarConfiguracao(bd, admin, { chave: "dias_produto_parado", valor: "090" });
    const [cfg] = await listarConfiguracoes(bd, admin);
    expect(cfg.valor).toBe("90");
  });
});

describe("RN-80 e RN-81: auditoria com antes e depois", () => {
  async function ultimo(acao: string, entidade: string, entidadeId?: string | null) {
    let consulta = bd
      .selectFrom("app.auditoria")
      .select(["usuario_id", "acao", "entidade", "entidade_id", "dados_antes", "dados_depois"])
      .where("acao", "=", acao)
      .where("entidade", "=", entidade);
    if (entidadeId !== undefined) {
      consulta = entidadeId === null ? consulta.where("entidade_id", "is", null) : consulta.where("entidade_id", "=", entidadeId);
    }
    return consulta.orderBy("id", "desc").executeTakeFirst();
  }

  it("login com sucesso e com falha", async () => {
    const pronto = await criarUsuarioPronto(bd, admin, "VENDEDOR");
    expect(await ultimo("LOGIN", "usuario", pronto.ator.id)).toMatchObject({
      usuario_id: pronto.ator.id,
      dados_depois: { login: pronto.login },
    });

    await entrar(bd, { login: pronto.login, senha: "senha-errada-000" }).catch(() => null);
    expect(await ultimo("LOGIN_FALHA", "usuario", pronto.ator.id)).toMatchObject({
      dados_depois: { login: pronto.login, motivo: "SENHA_INCORRETA" },
    });

    await entrar(bd, { login: "fantasma", senha: "x" }).catch(() => null);
    expect(await ultimo("LOGIN_FALHA", "usuario", null)).toMatchObject({
      usuario_id: null,
      dados_depois: { login: "fantasma", motivo: "LOGIN_INEXISTENTE" },
    });
  });

  it("criação e alteração de usuário e redefinição de senha", async () => {
    const login = nomeUnico("aud");
    const id = await criarUsuario(bd, admin, { nome: "Antes", login, perfil: "VENDEDOR", senha: SENHA_PADRAO });
    expect(await ultimo("CRIAR", "usuario", id)).toMatchObject({
      usuario_id: admin.id,
      dados_antes: null,
      dados_depois: { id, nome: "Antes", login, perfil: "VENDEDOR", ativo: true, deve_trocar_senha: true },
    });

    await editarUsuario(bd, admin, { id, nome: "Depois", perfil: "ADMINISTRADOR" });
    expect(await ultimo("ALTERAR", "usuario", id)).toMatchObject({
      usuario_id: admin.id,
      dados_antes: { nome: "Antes", perfil: "VENDEDOR" },
      dados_depois: { nome: "Depois", perfil: "ADMINISTRADOR" },
    });

    await redefinirSenha(bd, admin, { id, senha: "senha-provisoria-4" });
    expect(await ultimo("REDEFINIR_SENHA", "usuario", id)).toMatchObject({
      usuario_id: admin.id,
      dados_antes: { id },
      dados_depois: { id, deve_trocar_senha: true },
    });

    await desativarUsuario(bd, admin, id);
    expect(await ultimo("DESATIVAR", "usuario", id)).toMatchObject({
      dados_antes: { ativo: true },
      dados_depois: { ativo: false },
    });
  });

  it("alteração de cadastros e de configuração", async () => {
    const id = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Relógios" });
    expect(await ultimo("CRIAR", "categoria", id)).toMatchObject({ dados_depois: { id, nome: "Relógios", ativo: true } });

    await renomearCadastro(bd, admin, { tipo: "categoria", id, nome: "Relógios de pulso" });
    expect(await ultimo("ALTERAR", "categoria", id)).toMatchObject({
      dados_antes: { nome: "Relógios" },
      dados_depois: { nome: "Relógios de pulso" },
    });

    await definirSituacaoCadastro(bd, admin, { tipo: "categoria", id, ativo: false });
    expect(await ultimo("DESATIVAR", "categoria", id)).toMatchObject({
      dados_antes: { ativo: true },
      dados_depois: { ativo: false },
    });

    await alterarConfiguracao(bd, admin, { chave: "dias_produto_parado", valor: "120" });
    expect(await ultimo("ALTERAR", "configuracao", "dias_produto_parado")).toMatchObject({
      usuario_id: admin.id,
      dados_depois: { chave: "dias_produto_parado", valor: "120" },
    });
  });

  it("a consulta filtra por entidade, usuário e período", async () => {
    const porEntidade = await consultarAuditoria(bd, admin, { entidade: "configuracao" });
    expect(porEntidade.registros.length).toBeGreaterThan(0);
    expect(porEntidade.registros.every((r) => r.entidade === "configuracao")).toBe(true);

    const porUsuario = await consultarAuditoria(bd, admin, { usuarioId: vendedor.id });
    expect(porUsuario.registros.length).toBeGreaterThan(0);
    expect(porUsuario.registros.every((r) => r.usuarioId === vendedor.id)).toBe(true);

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const deHoje = await consultarAuditoria(bd, admin, { de: hoje, ate: hoje });
    expect(deHoje.registros.length).toBeGreaterThan(0);
    const passado = await consultarAuditoria(bd, admin, { de: "2000-01-01", ate: "2000-01-31" });
    expect(passado.registros).toHaveLength(0);

    // Mais recentes primeiro.
    const tudo = await consultarAuditoria(bd, admin, {});
    const momentos = tudo.registros.map((r) => r.ocorridoEm.getTime());
    expect([...momentos].sort((a, b) => b - a)).toEqual(momentos);
  });
});
