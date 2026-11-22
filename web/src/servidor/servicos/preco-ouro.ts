// Preço do ouro (RN-66, RN-67). Cada registro é imutável: uma correção é um registro novo.

import { sql } from "kysely";
import { z } from "zod";
import type { Bd } from "../bd/conexao";
import { traduzirErroBanco } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { validar } from "../validacao";

const esquemaRegistro = z.object({
  valorGrama: z
    .string({ error: "Informe o valor por grama." })
    .trim()
    .transform((v) => (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v) && Number(v) > 0, {
      error: "Informe um valor por grama maior que zero, com até 2 casas decimais.",
    }),
  vigenteDesde: z
    .string({ error: "Informe a data de vigência." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Informe a data de vigência." })
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Data de vigência inválida." }),
});

export async function registrarPrecoOuro(bd: Bd, ator: Ator, entrada: unknown): Promise<string> {
  exigirPermissao(ator, "preco_ouro.gerenciar");
  const d = validar(esquemaRegistro, entrada);
  try {
    const criado = await bd
      .insertInto("app.preco_ouro")
      .values({ valor_grama: d.valorGrama, vigente_desde: d.vigenteDesde, registrado_por: ator.id })
      .returning("id")
      .executeTakeFirstOrThrow();
    return criado.id;
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
}

/** Histórico do mais recente para o mais antigo, com quem registrou. */
export async function listarPrecosOuro(bd: Bd, ator: Ator) {
  exigirPermissao(ator, "preco_ouro.gerenciar");
  return bd
    .selectFrom("app.preco_ouro as p")
    .innerJoin("app.usuario as u", "u.id", "p.registrado_por")
    .select([
      "p.id",
      "p.valor_grama as valorGrama",
      "p.vigente_desde as vigenteDesde",
      "p.registrado_em as registradoEm",
      "u.nome as registradoPor",
    ])
    .orderBy("p.vigente_desde", "desc")
    .orderBy("p.id", "desc")
    .execute();
}

/** RN-67: preço vigente numa data (hoje, por padrão). */
export async function precoOuroVigente(bd: Bd, data?: string): Promise<string | null> {
  const { rows } = await sql<{ valor: string | null }>`
    select app.preco_ouro_vigente(coalesce(${data ?? null}::date, (now() at time zone 'America/Sao_Paulo')::date)) as valor
  `.execute(bd);
  return rows[0]?.valor ?? null;
}
