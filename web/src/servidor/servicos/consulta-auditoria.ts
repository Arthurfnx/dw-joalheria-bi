// RN-81: consulta da auditoria, só para o administrador.

import { sql } from "kysely";
import type { Bd } from "../bd/conexao";
import { exigirPermissao, type Ator } from "../permissoes";
import { esquemaFiltroAuditoria, validar } from "../validacao";

export const LIMITE_REGISTROS_AUDITORIA = 300;

export interface RegistroAuditoria {
  id: string;
  ocorridoEm: Date;
  usuarioId: string | null;
  usuarioNome: string | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  dadosAntes: unknown;
  dadosDepois: unknown;
}

/**
 * O período é em dias do calendário de São Paulo: "até" inclui o dia inteiro.
 * Devolve no máximo LIMITE_REGISTROS_AUDITORIA linhas, das mais recentes.
 */
export async function consultarAuditoria(
  bd: Bd,
  ator: Ator,
  filtroEntrada: unknown,
): Promise<{ registros: RegistroAuditoria[]; limiteAtingido: boolean }> {
  exigirPermissao(ator, "auditoria.consultar");
  const filtro = validar(esquemaFiltroAuditoria, filtroEntrada ?? {});

  let consulta = bd
    .selectFrom("app.auditoria as a")
    .leftJoin("app.usuario as u", "u.id", "a.usuario_id")
    .select([
      "a.id",
      "a.ocorrido_em as ocorridoEm",
      "a.usuario_id as usuarioId",
      "u.nome as usuarioNome",
      "a.acao",
      "a.entidade",
      "a.entidade_id as entidadeId",
      "a.dados_antes as dadosAntes",
      "a.dados_depois as dadosDepois",
    ]);

  if (filtro.de) {
    consulta = consulta.where(sql<boolean>`a.ocorrido_em >= (${filtro.de}::date)::timestamp at time zone 'America/Sao_Paulo'`);
  }
  if (filtro.ate) {
    consulta = consulta.where(
      sql<boolean>`a.ocorrido_em < (${filtro.ate}::date + 1)::timestamp at time zone 'America/Sao_Paulo'`,
    );
  }
  if (filtro.usuarioId) consulta = consulta.where("a.usuario_id", "=", filtro.usuarioId);
  if (filtro.entidade) consulta = consulta.where("a.entidade", "=", filtro.entidade);

  const linhas = await consulta
    .orderBy("a.ocorrido_em", "desc")
    .orderBy("a.id", "desc")
    .limit(LIMITE_REGISTROS_AUDITORIA + 1)
    .execute();

  return {
    registros: linhas.slice(0, LIMITE_REGISTROS_AUDITORIA),
    limiteAtingido: linhas.length > LIMITE_REGISTROS_AUDITORIA,
  };
}

/** Opções dos filtros: usuários e entidades que aparecem na auditoria. */
export async function opcoesFiltroAuditoria(
  bd: Bd,
  ator: Ator,
): Promise<{ usuarios: { id: string; nome: string }[]; entidades: string[] }> {
  exigirPermissao(ator, "auditoria.consultar");
  const [usuarios, entidades] = await Promise.all([
    bd.selectFrom("app.usuario").select(["id", "nome"]).orderBy("nome").execute(),
    bd.selectFrom("app.auditoria").select("entidade").distinct().orderBy("entidade").execute(),
  ]);
  return { usuarios, entidades: entidades.map((e) => e.entidade) };
}
