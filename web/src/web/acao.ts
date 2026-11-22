// Envoltório comum das ações de servidor: confere a origem, a sessão e
// traduz os erros de negócio em mensagem para a tela.

import { headers } from "next/headers";
import { ErroAplicacao, ErroPermissao } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { mesmaOrigem } from "@/servidor/seguranca/origem";
import { estadoErro, estadoOk, type EstadoAcao } from "./estado-acao";
import { obterAtor } from "./sessao";

/**
 * O Next.js já compara Origin e Host nas ações de servidor; a verificação é
 * repetida aqui para que a regra não dependa de um detalhe do framework.
 */
export async function exigirMesmaOrigem(): Promise<void> {
  const h = await headers();
  if (!mesmaOrigem(h.get("origin"), h.get("x-forwarded-host") ?? h.get("host"))) {
    throw new ErroPermissao("Requisição recusada: origem não permitida.");
  }
}

/** Converte um erro em estado de tela. Erros inesperados não expõem detalhes. */
export function traduzirErro(erro: unknown): EstadoAcao {
  if (erro instanceof ErroAplicacao) return estadoErro(erro.message);
  console.error("Falha inesperada numa ação de servidor:", erro instanceof Error ? erro.name : typeof erro);
  return estadoErro("Não foi possível concluir a operação. Tente novamente.");
}

/**
 * Executa uma operação que exige sessão. Sem sessão válida, devolve erro
 * (a tela seguinte leva ao login). A permissão do perfil é verificada pela
 * própria camada de servidor chamada em `operacao`.
 */
export async function executarAcao(
  operacao: (ator: Ator) => Promise<string>,
): Promise<EstadoAcao> {
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return estadoErro("Sessão encerrada. Entre novamente.");
    return estadoOk(await operacao(ator));
  } catch (erro) {
    return traduzirErro(erro);
  }
}

export function campo(formulario: FormData, nome: string): string | undefined {
  const valor = formulario.get(nome);
  return typeof valor === "string" ? valor : undefined;
}
