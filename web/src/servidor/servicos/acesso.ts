// Acesso: login, sessão, saída e troca de senha (RN-01 a RN-05).

import { sql } from "kysely";
import type { Bd } from "../bd/conexao";
import { registrarAuditoria } from "../auditoria";
import { ErroCredenciais, ErroValidacao } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { gerarHashSenha, verificarSenha, igualarTempoDeVerificacao } from "../seguranca/senha";
import { gerarTokenSessao, hashToken } from "../seguranca/token";
import { esquemaLoginEntrada, esquemaTrocarSenha, validar } from "../validacao";

export const LIMITE_FALHAS_LOGIN = 5;
export const MINUTOS_BLOQUEIO = 15;
export const HORAS_INATIVIDADE_SESSAO = 8;
export const DIAS_DURACAO_MAXIMA_SESSAO = 7;

export interface ResultadoLogin {
  token: string;
  ator: Ator;
}

/**
 * RN-01 e RN-02. Qualquer falha lança a mesma ErroCredenciais. A contagem de
 * falhas e a auditoria precisam ser gravadas mesmo quando o login falha, por
 * isso a transação devolve o resultado e o erro só é lançado depois do commit.
 */
export async function entrar(bd: Bd, entrada: unknown): Promise<ResultadoLogin> {
  const { login, senha } = validar(esquemaLoginEntrada, entrada);

  const resultado = await bd.transaction().execute(async (trx) => {
    const usuario = await trx
      .selectFrom("app.usuario")
      .select(["id", "nome", "login", "perfil", "senha_hash", "ativo", "deve_trocar_senha", "falhas_login"])
      .select(sql<boolean>`coalesce(bloqueado_ate > now(), false)`.as("bloqueado"))
      .where("login", "=", login)
      .forUpdate()
      .executeTakeFirst();

    const falha = async (usuarioId: string | null, motivo: string, extra: Record<string, unknown> = {}) => {
      await registrarAuditoria(trx, {
        usuarioId,
        acao: "LOGIN_FALHA",
        entidade: "usuario",
        entidadeId: usuarioId,
        depois: { login, motivo, ...extra },
      });
      return null;
    };

    if (!usuario) {
      await igualarTempoDeVerificacao(senha);
      return falha(null, "LOGIN_INEXISTENTE");
    }

    // RN-02: durante o bloqueio a senha nem é conferida, e a tentativa não prolonga o prazo.
    if (usuario.bloqueado) {
      await igualarTempoDeVerificacao(senha);
      return falha(usuario.id, "BLOQUEADO");
    }

    const senhaConfere = await verificarSenha(usuario.senha_hash, senha);
    if (!senhaConfere) {
      const falhas = usuario.falhas_login + 1;
      const bloquear = falhas >= LIMITE_FALHAS_LOGIN;
      await trx
        .updateTable("app.usuario")
        .set({
          falhas_login: bloquear ? 0 : falhas,
          bloqueado_ate: bloquear ? sql<Date>`now() + make_interval(mins => ${MINUTOS_BLOQUEIO})` : null,
        })
        .where("id", "=", usuario.id)
        .execute();
      return falha(usuario.id, "SENHA_INCORRETA", { falhas_seguidas: falhas, bloqueio_aplicado: bloquear });
    }

    if (!usuario.ativo) {
      return falha(usuario.id, "USUARIO_INATIVO");
    }

    await trx
      .updateTable("app.usuario")
      .set({ falhas_login: 0, bloqueado_ate: null })
      .where("id", "=", usuario.id)
      .execute();

    const token = gerarTokenSessao();
    await trx
      .insertInto("app.sessao")
      .values({
        token_hash: hashToken(token),
        usuario_id: usuario.id,
        expira_em: sql<Date>`now() + make_interval(days => ${DIAS_DURACAO_MAXIMA_SESSAO})`,
      })
      .execute();

    await registrarAuditoria(trx, {
      usuarioId: usuario.id,
      acao: "LOGIN",
      entidade: "usuario",
      entidadeId: usuario.id,
      depois: { login },
    });

    const ator: Ator = {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfil: usuario.perfil,
      deveTrocarSenha: usuario.deve_trocar_senha,
    };
    return { token, ator };
  });

  if (!resultado) throw new ErroCredenciais();
  return resultado;
}

/**
 * RN-05: a sessão vale enquanto não for revogada, não passar de 7 dias desde
 * a criação nem ficar 8 horas sem uso, e o usuário continuar ativo. Os prazos
 * são comparados com o relógio do banco.
 */
export async function validarSessao(bd: Bd, token: string | undefined | null): Promise<Ator | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const linha = await bd
    .selectFrom("app.sessao as s")
    .innerJoin("app.usuario as u", "u.id", "s.usuario_id")
    .select(["u.id", "u.nome", "u.login", "u.perfil", "u.deve_trocar_senha"])
    // Renova o último uso no máximo uma vez por minuto, para não gravar a cada requisição.
    .select(sql<boolean>`s.ultimo_uso_em < now() - interval '1 minute'`.as("renovar"))
    .where("s.token_hash", "=", tokenHash)
    .where("s.revogada_em", "is", null)
    .where(sql<boolean>`s.expira_em > now()`)
    .where(sql<boolean>`s.ultimo_uso_em > now() - make_interval(hours => ${HORAS_INATIVIDADE_SESSAO})`)
    .where("u.ativo", "=", true)
    .executeTakeFirst();

  if (!linha) return null;

  if (linha.renovar) {
    await bd
      .updateTable("app.sessao")
      .set({ ultimo_uso_em: sql<Date>`now()` })
      .where("token_hash", "=", tokenHash)
      .execute();
  }

  return {
    id: linha.id,
    nome: linha.nome,
    login: linha.login,
    perfil: linha.perfil,
    deveTrocarSenha: linha.deve_trocar_senha,
  };
}

/** RN-05: sair revoga a sessão. */
export async function sair(bd: Bd, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await bd.transaction().execute(async (trx) => {
    const revogada = await trx
      .updateTable("app.sessao")
      .set({ revogada_em: sql<Date>`now()` })
      .where("token_hash", "=", hashToken(token))
      .where("revogada_em", "is", null)
      .returning("usuario_id")
      .executeTakeFirst();
    if (revogada) {
      await registrarAuditoria(trx, {
        usuarioId: revogada.usuario_id,
        acao: "SAIR",
        entidade: "usuario",
        entidadeId: revogada.usuario_id,
      });
    }
  });
}

/** RN-04: troca da própria senha, obrigatória no primeiro acesso. */
export async function trocarSenha(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "senha.trocar");
  const dados = validar(esquemaTrocarSenha, entrada);

  await bd.transaction().execute(async (trx) => {
    const atual = await trx
      .selectFrom("app.usuario")
      .select(["senha_hash", "deve_trocar_senha"])
      .where("id", "=", ator.id)
      .where("ativo", "=", true)
      .forUpdate()
      .executeTakeFirst();
    if (!atual || !(await verificarSenha(atual.senha_hash, dados.senhaAtual))) {
      throw new ErroValidacao("A senha atual não confere.");
    }

    await trx
      .updateTable("app.usuario")
      .set({
        senha_hash: await gerarHashSenha(dados.novaSenha),
        deve_trocar_senha: false,
        atualizado_em: sql<Date>`now()`,
      })
      .where("id", "=", ator.id)
      .execute();

    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "TROCAR_SENHA",
      entidade: "usuario",
      entidadeId: ator.id,
      antes: { deve_trocar_senha: atual.deve_trocar_senha },
      depois: { deve_trocar_senha: false },
    });
  });
}
