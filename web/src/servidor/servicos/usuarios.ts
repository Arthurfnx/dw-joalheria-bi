// Gestão de usuários (RN-03, RN-04, RN-05, RN-06, RN-07).

import { sql } from "kysely";
import type { Bd, Trx } from "../bd/conexao";
import { registrarAuditoria } from "../auditoria";
import { ErroNaoEncontrado, ErroNegocio, ehViolacaoDeUnicidade } from "../erros";
import { exigirPermissao, type Ator, type Perfil } from "../permissoes";
import { gerarHashSenha } from "../seguranca/senha";
import {
  esquemaCriarUsuario,
  esquemaEditarUsuario,
  esquemaId,
  esquemaRedefinirSenha,
  validar,
} from "../validacao";

export interface UsuarioResumo {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
  deveTrocarSenha: boolean;
  bloqueado: boolean;
  criadoEm: Date;
}

// Campos que aparecem na auditoria; senha_hash nunca entra (RN-03).
const CAMPOS_AUDITADOS = ["id", "nome", "login", "perfil", "ativo", "deve_trocar_senha"] as const;

export async function listarUsuarios(bd: Bd, ator: Ator): Promise<UsuarioResumo[]> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const linhas = await bd
    .selectFrom("app.usuario")
    .select(["id", "nome", "login", "perfil", "ativo", "deve_trocar_senha", "criado_em"])
    .select(sql<boolean>`coalesce(bloqueado_ate > now(), false)`.as("bloqueado"))
    .orderBy("ativo", "desc")
    .orderBy("nome")
    .execute();
  return linhas.map((u) => ({
    id: u.id,
    nome: u.nome,
    login: u.login,
    perfil: u.perfil,
    ativo: u.ativo,
    deveTrocarSenha: u.deve_trocar_senha,
    bloqueado: u.bloqueado,
    criadoEm: u.criado_em,
  }));
}

async function carregarParaAlterar(trx: Trx, id: string) {
  const usuario = await trx
    .selectFrom("app.usuario")
    .select(CAMPOS_AUDITADOS)
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
  if (!usuario) throw new ErroNaoEncontrado("Usuário não encontrado.");
  return usuario;
}

/**
 * RN-06: o sistema não fica sem administrador ativo. Bloqueia todas as linhas
 * de administradores ativos para que duas desativações simultâneas não passem
 * ambas pela verificação.
 */
async function garantirOutroAdministradorAtivo(trx: Trx, usuarioId: string): Promise<void> {
  const administradores = await trx
    .selectFrom("app.usuario")
    .select("id")
    .where("perfil", "=", "ADMINISTRADOR")
    .where("ativo", "=", true)
    .orderBy("id")
    .forUpdate()
    .execute();
  if (!administradores.some((a) => a.id !== usuarioId)) {
    throw new ErroNegocio("Não é possível: este é o último administrador ativo.");
  }
}

async function revogarSessoes(trx: Trx, usuarioId: string): Promise<void> {
  await trx
    .updateTable("app.sessao")
    .set({ revogada_em: sql<Date>`now()` })
    .where("usuario_id", "=", usuarioId)
    .where("revogada_em", "is", null)
    .execute();
}

async function inserirUsuario(
  trx: Trx,
  dados: { nome: string; login: string; perfil: Perfil; senha: string; deveTrocarSenha: boolean },
) {
  try {
    return await trx
      .insertInto("app.usuario")
      .values({
        nome: dados.nome,
        login: dados.login,
        perfil: dados.perfil,
        senha_hash: await gerarHashSenha(dados.senha),
        deve_trocar_senha: dados.deveTrocarSenha,
      })
      .returning(CAMPOS_AUDITADOS)
      .executeTakeFirstOrThrow();
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) throw new ErroNegocio("Já existe um usuário com este login.");
    throw erro;
  }
}

/** RN-04: o usuário criado pelo administrador troca a senha no primeiro acesso. */
export async function criarUsuario(bd: Bd, ator: Ator, entrada: unknown): Promise<string> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const dados = validar(esquemaCriarUsuario, entrada);
  return bd.transaction().execute(async (trx) => {
    const criado = await inserirUsuario(trx, { ...dados, deveTrocarSenha: true });
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "CRIAR",
      entidade: "usuario",
      entidadeId: criado.id,
      depois: criado,
    });
    return criado.id;
  });
}

/** RN-06: edita nome e perfil. O login não muda depois de criado. */
export async function editarUsuario(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const dados = validar(esquemaEditarUsuario, entrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregarParaAlterar(trx, dados.id);
    // Rebaixar o último administrador ativo equivale a desativá-lo como administrador.
    if (antes.perfil === "ADMINISTRADOR" && dados.perfil !== "ADMINISTRADOR" && antes.ativo) {
      await garantirOutroAdministradorAtivo(trx, dados.id);
    }
    const depois = await trx
      .updateTable("app.usuario")
      .set({ nome: dados.nome, perfil: dados.perfil, atualizado_em: sql<Date>`now()` })
      .where("id", "=", dados.id)
      .returning(CAMPOS_AUDITADOS)
      .executeTakeFirstOrThrow();
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "ALTERAR",
      entidade: "usuario",
      entidadeId: dados.id,
      antes,
      depois,
    });
  });
}

/** RN-05 e RN-06: desativar revoga todas as sessões; o último administrador ativo não é desativado. */
export async function desativarUsuario(bd: Bd, ator: Ator, idEntrada: unknown): Promise<void> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const id = validar(esquemaId, idEntrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregarParaAlterar(trx, id);
    if (!antes.ativo) throw new ErroNegocio("O usuário já está inativo.");
    if (antes.perfil === "ADMINISTRADOR") await garantirOutroAdministradorAtivo(trx, id);
    const depois = await trx
      .updateTable("app.usuario")
      .set({ ativo: false, atualizado_em: sql<Date>`now()` })
      .where("id", "=", id)
      .returning(CAMPOS_AUDITADOS)
      .executeTakeFirstOrThrow();
    await revogarSessoes(trx, id);
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "DESATIVAR",
      entidade: "usuario",
      entidadeId: id,
      antes,
      depois,
    });
  });
}

export async function reativarUsuario(bd: Bd, ator: Ator, idEntrada: unknown): Promise<void> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const id = validar(esquemaId, idEntrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregarParaAlterar(trx, id);
    if (antes.ativo) throw new ErroNegocio("O usuário já está ativo.");
    const depois = await trx
      .updateTable("app.usuario")
      .set({ ativo: true, falhas_login: 0, bloqueado_ate: null, atualizado_em: sql<Date>`now()` })
      .where("id", "=", id)
      .returning(CAMPOS_AUDITADOS)
      .executeTakeFirstOrThrow();
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "REATIVAR",
      entidade: "usuario",
      entidadeId: id,
      antes,
      depois,
    });
  });
}

/**
 * RN-04, RN-05 e RN-06: o administrador define uma senha provisória; o
 * usuário precisa trocá-la no próximo acesso e perde as sessões abertas. O
 * bloqueio por falhas também é zerado, porque a redefinição é o caminho de
 * recuperação de quem esqueceu a senha.
 */
export async function redefinirSenha(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "usuarios.gerenciar");
  const dados = validar(esquemaRedefinirSenha, entrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregarParaAlterar(trx, dados.id);
    const depois = await trx
      .updateTable("app.usuario")
      .set({
        senha_hash: await gerarHashSenha(dados.senha),
        deve_trocar_senha: true,
        falhas_login: 0,
        bloqueado_ate: null,
        atualizado_em: sql<Date>`now()`,
      })
      .where("id", "=", dados.id)
      .returning(CAMPOS_AUDITADOS)
      .executeTakeFirstOrThrow();
    await revogarSessoes(trx, dados.id);
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "REDEFINIR_SENHA",
      entidade: "usuario",
      entidadeId: dados.id,
      antes,
      depois,
    });
  });
}

/**
 * RN-07: primeiro administrador, criado pelo comando de linha. Recusa se já
 * houver um administrador ativo, para que o comando não sirva de porta dos
 * fundos: a partir daí, quem cria usuários é o administrador, pela tela.
 */
export async function criarAdministradorInicial(bd: Bd, entrada: unknown): Promise<string> {
  const dados = validar(esquemaCriarUsuario, { ...(entrada as object), perfil: "ADMINISTRADOR" });
  return bd.transaction().execute(async (trx) => {
    const existente = await trx
      .selectFrom("app.usuario")
      .select("id")
      .where("perfil", "=", "ADMINISTRADOR")
      .where("ativo", "=", true)
      .forUpdate()
      .executeTakeFirst();
    if (existente) {
      throw new ErroNegocio("Já existe um administrador ativo. Crie os demais usuários pela tela de administração.");
    }
    // A senha foi digitada pelo próprio administrador: não há troca obrigatória.
    const criado = await inserirUsuario(trx, { ...dados, deveTrocarSenha: false });
    await registrarAuditoria(trx, {
      usuarioId: null,
      acao: "CRIAR",
      entidade: "usuario",
      entidadeId: criado.id,
      depois: { ...criado, origem: "LINHA_DE_COMANDO" },
    });
    return criado.id;
  });
}
