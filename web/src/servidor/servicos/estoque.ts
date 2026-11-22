// Saídas não comerciais e ajustes (RN-34, RN-35, RN-36). A escrita é sempre
// da função app.movimentar_manual: a aplicação não grava movimentação nem saldo.

import { sql } from "kysely";
import { z } from "zod";
import type { Bd } from "../bd/conexao";
import { traduzirErroBanco } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { esquemaId, validar } from "../validacao";

export const TIPOS_MOVIMENTACAO_MANUAL = [
  { codigo: "SAIDA_PRESENTE", rotulo: "Saída para presente" },
  { codigo: "SAIDA_PERDA", rotulo: "Saída por perda" },
  { codigo: "SAIDA_ROUBO", rotulo: "Saída por roubo" },
  { codigo: "AJUSTE_POSITIVO", rotulo: "Ajuste positivo" },
  { codigo: "AJUSTE_NEGATIVO", rotulo: "Ajuste negativo" },
] as const;

const esquemaMovimentacao = z.object({
  produtoId: esquemaId,
  tipo: z.enum(
    TIPOS_MOVIMENTACAO_MANUAL.map((t) => t.codigo) as [string, ...string[]],
    { error: "Escolha o tipo de movimentação." },
  ),
  quantidade: z.coerce
    .number({ error: "Informe a quantidade." })
    .int({ error: "A quantidade deve ser inteira." })
    .min(1, { error: "A quantidade deve ser maior que zero." })
    .max(100000),
  dataOcorrencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Informe a data da ocorrência." }),
  motivo: z
    .string({ error: "Informe o motivo." })
    .trim()
    .min(1, { error: "Informe o motivo." })
    .max(500, { error: "O motivo deve ter no máximo 500 caracteres." }),
});

/** Devolve o id da movimentação gravada. Saldo, peça única e data futura são conferidos pelo banco. */
export async function movimentarEstoque(bd: Bd, ator: Ator, entrada: unknown): Promise<string> {
  exigirPermissao(ator, "estoque.movimentar");
  const d = validar(esquemaMovimentacao, entrada);
  try {
    const { rows } = await sql<{ id: string }>`
      select app.movimentar_manual(${d.produtoId}::bigint, ${d.tipo}, ${d.quantidade}::integer,
        ${d.dataOcorrencia}::date, ${d.motivo}, null, ${ator.id}::bigint) as id
    `.execute(bd);
    return rows[0].id;
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
}
