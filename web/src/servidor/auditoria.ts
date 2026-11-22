// RN-80 e RN-81: registro de quem, quando, ação, entidade, antes e depois.

import type { Bd, Trx } from "./bd/conexao";

export type DadosAuditoria = Record<string, unknown> | null;

// Nenhum campo de senha, hash ou token chega à auditoria, mesmo que um chamador
// o passe por engano (RN-03). "deve_trocar_senha" é um indicador e continua.
const CAMPOS_PROIBIDOS = /^senha|^nova_?senha|hash$|^token/i;

export function sanitizarDados(dados: DadosAuditoria): DadosAuditoria {
  if (dados === null) return null;
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (CAMPOS_PROIBIDOS.test(chave)) continue;
    limpo[chave] = valor instanceof Date ? valor.toISOString() : valor;
  }
  return limpo;
}

export async function registrarAuditoria(
  bd: Bd | Trx,
  registro: {
    usuarioId: string | null;
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    antes?: DadosAuditoria;
    depois?: DadosAuditoria;
  },
): Promise<void> {
  const antes = sanitizarDados(registro.antes ?? null);
  const depois = sanitizarDados(registro.depois ?? null);
  await bd
    .insertInto("app.auditoria")
    .values({
      usuario_id: registro.usuarioId,
      acao: registro.acao,
      entidade: registro.entidade,
      entidade_id: registro.entidadeId ?? null,
      dados_antes: antes === null ? null : JSON.stringify(antes),
      dados_depois: depois === null ? null : JSON.stringify(depois),
    })
    .execute();
}
