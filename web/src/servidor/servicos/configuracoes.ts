// Parâmetros de configuração (especificação, seção 4.5). Só os parâmetros
// conhecidos pelo código podem ser editados, cada um com a sua validação.

import { sql } from "kysely";
import { z } from "zod";
import type { Bd } from "../bd/conexao";
import { registrarAuditoria } from "../auditoria";
import { ErroNaoEncontrado } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { validar } from "../validacao";

const VALIDACAO_POR_CHAVE: Record<string, z.ZodType<string>> = {
  dias_produto_parado: z
    .string({ error: "Informe o número de dias." })
    .trim()
    .regex(/^\d+$/, { error: "Informe um número inteiro de dias." })
    .refine((v) => Number(v) >= 1 && Number(v) <= 3650, { error: "Informe de 1 a 3650 dias." })
    // Guarda sem zeros à esquerda, para o valor ser lido sempre igual.
    .transform((v) => String(Number(v))),
  // RN-68: aceita vírgula ou ponto; guarda com ponto, que é o que o banco converte em numeric.
  fator_preco_ouro: z
    .string({ error: "Informe o fator." })
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d{1,3}(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
      error: "Informe um fator positivo, com até 4 casas decimais.",
    })
    .transform((v) => v.replace(/^0+(?=\d)/, "")),
};

export interface ItemConfiguracao {
  chave: string;
  valor: string;
  descricao: string;
  atualizadoEm: Date;
  atualizadoPor: string | null;
}

export async function listarConfiguracoes(bd: Bd, ator: Ator): Promise<ItemConfiguracao[]> {
  exigirPermissao(ator, "configuracoes.gerenciar");
  return bd
    .selectFrom("app.configuracao as c")
    .leftJoin("app.usuario as u", "u.id", "c.atualizado_por")
    .select(["c.chave", "c.valor", "c.descricao", "c.atualizado_em as atualizadoEm", "u.nome as atualizadoPor"])
    .orderBy("c.chave")
    .execute();
}

export async function alterarConfiguracao(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "configuracoes.gerenciar");
  const { chave, valor } = validar(
    z.object({ chave: z.string({ error: "Parâmetro inválido." }), valor: z.string({ error: "Informe o valor." }) }),
    entrada,
  );
  const validacao = VALIDACAO_POR_CHAVE[chave];
  if (!validacao) throw new ErroNaoEncontrado("Parâmetro de configuração desconhecido.");
  const novoValor = validar(validacao, valor);

  await bd.transaction().execute(async (trx) => {
    const antes = await trx
      .selectFrom("app.configuracao")
      .select(["chave", "valor"])
      .where("chave", "=", chave)
      .forUpdate()
      .executeTakeFirst();
    if (!antes) throw new ErroNaoEncontrado("Parâmetro de configuração não encontrado.");
    const depois = await trx
      .updateTable("app.configuracao")
      .set({ valor: novoValor, atualizado_em: sql<Date>`now()`, atualizado_por: ator.id })
      .where("chave", "=", chave)
      .returning(["chave", "valor"])
      .executeTakeFirstOrThrow();
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "ALTERAR",
      entidade: "configuracao",
      entidadeId: chave,
      antes,
      depois,
    });
  });
}
