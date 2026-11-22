"use server";

// Ações de venda. A permissão de cada uma é verificada pela camada de servidor.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroAplicacao } from "@/servidor/erros";
import { buscarProdutosParaVenda, cancelarVenda, confirmarVenda, type ProdutoParaVenda } from "@/servidor/servicos/vendas";
import { campo, executarAcao, exigirMesmaOrigem, traduzirErro } from "@/web/acao";
import { estadoErro, type EstadoAcao } from "@/web/estado-acao";
import { obterAtor } from "@/web/sessao";

/** Busca da nova venda: devolve só o que a tela precisa, sem custos. */
export async function acaoBuscarProdutosVenda(termo: string): Promise<{ produtos: ProdutoParaVenda[]; erro?: string }> {
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return { produtos: [], erro: "Sessão encerrada. Entre novamente." };
    if (termo.trim() === "") return { produtos: [] };
    return { produtos: await buscarProdutosParaVenda(bdAplicacao(), ator, termo) };
  } catch (erro) {
    if (erro instanceof ErroAplicacao) return { produtos: [], erro: erro.message };
    throw erro;
  }
}

export async function acaoConfirmarVenda(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  let id: string;
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return estadoErro("Sessão encerrada. Entre novamente.");
    let itens: unknown;
    try {
      itens = JSON.parse(campo(f, "itens") ?? "[]");
    } catch {
      return estadoErro("Itens inválidos.");
    }
    ({ id } = await confirmarVenda(bdAplicacao(), ator, {
      chave: campo(f, "chave"),
      dataVenda: campo(f, "dataVenda"),
      observacao: campo(f, "observacao"),
      itens,
    }));
  } catch (erro) {
    return traduzirErro(erro);
  }
  revalidatePath("/vendas");
  revalidatePath("/");
  redirect(`/vendas/${id}`);
}

export async function acaoCancelarVenda(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await cancelarVenda(bdAplicacao(), ator, { id: campo(f, "id"), motivo: campo(f, "motivo") });
    revalidatePath("/vendas");
    revalidatePath("/");
    return "Venda cancelada. O estoque dos itens foi devolvido.";
  });
}
