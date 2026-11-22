// Importação das planilhas (seção 6) e consulta dos lotes e ocorrências.

import { sql } from "kysely";
import { z } from "zod";
import type { Bd } from "../bd/conexao";
import { ErroNegocio, traduzirErroBanco } from "../erros";
import { GRAFIAS_CATEGORIA } from "../importacao/categorias";
import type { LinhaImportacao } from "../importacao/leitura";
import { exigirPermissao, type Ator } from "../permissoes";
import { esquemaId, esquemaLogin, validar } from "../validacao";

export type ContagensAba = Record<string, number>;

export interface ResultadoImportacao {
  loteId: string;
  contagens: Record<string, ContagensAba>;
  ocorrenciasPorMotivo: { tipo: string; motivo: string; quantidade: number }[];
  conferencia: {
    abasConferem: boolean;
    somaSaldos: number;
    pecasEmEstoqueEConsignadas: number;
    divergenciasDeSaldo: number;
  };
}

/**
 * Executa a importação como o administrador do login informado. As regras
 * ficam em app.importar_lote, numa única transação (RN-102); esta camada só
 * identifica o usuário, envia as linhas e monta a conferência de RN-105.
 */
export async function importarPlanilhas(
  bd: Bd,
  entrada: { login: string; arquivo: string; linhas: LinhaImportacao[] },
): Promise<ResultadoImportacao> {
  const login = validar(esquemaLogin, entrada.login);
  const usuario = await bd
    .selectFrom("app.usuario")
    .select(["id"])
    .where("login", "=", login)
    .where("ativo", "=", true)
    .where("perfil", "=", "ADMINISTRADOR")
    .executeTakeFirst();
  if (!usuario) throw new ErroNegocio("O login informado não é de um administrador ativo.");

  let loteId: string;
  try {
    const { rows } = await sql<{ lote: string }>`
      select app.importar_lote(
        ${usuario.id}::bigint, ${entrada.arquivo}, ${JSON.stringify(entrada.linhas)}::jsonb,
        ${JSON.stringify(GRAFIAS_CATEGORIA)}::jsonb
      ) as lote
    `.execute(bd);
    loteId = rows[0].lote;
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
  return resumoDoLote(bd, loteId);
}

/** RN-104 e RN-105: só contagens e motivos agrupados, nunca registros individuais. */
export async function resumoDoLote(bd: Bd, loteId: string): Promise<ResultadoImportacao> {
  const lote = await bd
    .selectFrom("app.importacao_lote")
    .select(["contagens"])
    .where("id", "=", loteId)
    .executeTakeFirstOrThrow();

  const ocorrenciasPorMotivo = await bd
    .selectFrom("app.importacao_ocorrencia")
    .select(["tipo", "motivo", sql<number>`count(*)::int`.as("quantidade")])
    .where("lote_id", "=", loteId)
    .groupBy(["tipo", "motivo"])
    .orderBy("tipo")
    .orderBy("motivo")
    .execute();

  const { rows: saldos } = await sql<{ soma: number; pecas: number; divergencias: number }>`
    select
      (select coalesce(sum(s.quantidade), 0)::int
         from app.saldo_estoque s join app.produto_origem o on o.produto_id = s.produto_id
        where o.lote_id = ${loteId}) as soma,
      (select count(*)::int from app.produto_origem
        where lote_id = ${loteId} and situacao_original in ('EM_ESTOQUE', 'CONSIGNADA')) as pecas,
      (select count(*)::int from app.divergencia_saldo) as divergencias
  `.execute(bd);

  const contagens = lote.contagens;
  const abasConferem = Object.values(contagens).every((c) => c.lidas === c.importadas + c.rejeitadas);
  return {
    loteId,
    contagens,
    ocorrenciasPorMotivo,
    conferencia: {
      abasConferem,
      somaSaldos: saldos[0].soma,
      pecasEmEstoqueEConsignadas: saldos[0].pecas,
      divergenciasDeSaldo: saldos[0].divergencias,
    },
  };
}

export interface LoteResumo {
  id: string;
  arquivo: string;
  iniciadoEm: Date;
  concluidoEm: Date | null;
  usuarioNome: string;
  contagens: Record<string, ContagensAba>;
}

export async function listarLotes(bd: Bd, ator: Ator): Promise<LoteResumo[]> {
  exigirPermissao(ator, "importacao.consultar");
  return bd
    .selectFrom("app.importacao_lote as l")
    .innerJoin("app.usuario as u", "u.id", "l.usuario_id")
    .select([
      "l.id",
      "l.arquivo",
      "l.iniciado_em as iniciadoEm",
      "l.concluido_em as concluidoEm",
      "u.nome as usuarioNome",
      "l.contagens",
    ])
    .orderBy("l.id", "desc")
    .execute();
}

const esquemaFiltroOcorrencias = z.object({
  loteId: esquemaId,
  tipo: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["REJEITADA", "REVISAR"]).optional()),
});

export const LIMITE_OCORRENCIAS = 500;

export async function listarOcorrencias(bd: Bd, ator: Ator, filtro: unknown) {
  exigirPermissao(ator, "importacao.consultar");
  const f = validar(esquemaFiltroOcorrencias, filtro);
  let consulta = bd
    .selectFrom("app.importacao_ocorrencia")
    .select(["id", "aba", "linha", "codigo", "tipo", "motivo"])
    .where("lote_id", "=", f.loteId);
  if (f.tipo) consulta = consulta.where("tipo", "=", f.tipo);
  const linhas = await consulta.orderBy("aba").orderBy("linha").orderBy("id").limit(LIMITE_OCORRENCIAS + 1).execute();
  return { ocorrencias: linhas.slice(0, LIMITE_OCORRENCIAS), limiteAtingido: linhas.length > LIMITE_OCORRENCIAS };
}
