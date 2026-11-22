"use server";

// Ações de produtos, estoque, preço do ouro e categoria. A permissão de cada
// uma é verificada pela camada de servidor.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { definirUsaTamanho } from "@/servidor/servicos/cadastros";
import { movimentarEstoque } from "@/servidor/servicos/estoque";
import { registrarPrecoOuro } from "@/servidor/servicos/preco-ouro";
import { criarProduto, definirSituacaoProduto, editarProduto } from "@/servidor/servicos/produtos";
import { campo, executarAcao, exigirMesmaOrigem, traduzirErro } from "@/web/acao";
import { estadoErro, type EstadoAcao } from "@/web/estado-acao";
import { obterAtor } from "@/web/sessao";

function camposProduto(f: FormData) {
  return {
    codigo: campo(f, "codigo"),
    descricao: campo(f, "descricao"),
    materialId: campo(f, "materialId"),
    categoriaId: campo(f, "categoriaId"),
    subcategoriaId: campo(f, "subcategoriaId"),
    modoControle: campo(f, "modoControle"),
    pesoGramas: campo(f, "pesoGramas"),
    // O campo some da tela quando a categoria não usa tamanho; o servidor confere de novo.
    tamanho: campo(f, "tamanho") ?? null,
    pedras: campo(f, "pedras"),
    precoVenda: campo(f, "precoVenda"),
    estoqueMinimo: campo(f, "estoqueMinimo"),
    observacao: campo(f, "observacao"),
    indicePreco: campo(f, "indicePreco"),
    valorAquisicao: campo(f, "valorAquisicao"),
    dataAquisicao: campo(f, "dataAquisicao"),
    localEstoque: campo(f, "localEstoque"),
    consignadoCom: campo(f, "localEstoque") === "Consignado" ? campo(f, "consignadoCom") : null,
  };
}

export async function acaoCriarProduto(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  let id: string;
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return estadoErro("Sessão encerrada. Entre novamente.");
    id = await criarProduto(bdAplicacao(), ator, { produto: camposProduto(f), saldoInicial: campo(f, "saldoInicial") });
  } catch (erro) {
    return traduzirErro(erro);
  }
  revalidatePath("/produtos");
  redirect(`/produtos/${id}`);
}

export async function acaoEditarProduto(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  const id = campo(f, "id") ?? "";
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return estadoErro("Sessão encerrada. Entre novamente.");
    await editarProduto(bdAplicacao(), ator, { id, produto: camposProduto(f) });
  } catch (erro) {
    return traduzirErro(erro);
  }
  revalidatePath("/produtos");
  redirect(`/produtos/${encodeURIComponent(id)}`);
}

export async function acaoSituacaoProduto(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    const ativo = campo(f, "ativo") === "true";
    await definirSituacaoProduto(bdAplicacao(), ator, { id: campo(f, "id"), ativo });
    revalidatePath("/produtos");
    return ativo ? "Produto reativado." : "Produto desativado.";
  });
}

export async function acaoMovimentarEstoque(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await movimentarEstoque(bdAplicacao(), ator, {
      produtoId: campo(f, "produtoId"),
      tipo: campo(f, "tipo"),
      quantidade: campo(f, "quantidade"),
      dataOcorrencia: campo(f, "dataOcorrencia"),
      motivo: campo(f, "motivo"),
    });
    revalidatePath("/produtos");
    return "Movimentação registrada.";
  });
}

export async function acaoRegistrarPrecoOuro(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await registrarPrecoOuro(bdAplicacao(), ator, {
      valorGrama: campo(f, "valorGrama"),
      vigenteDesde: campo(f, "vigenteDesde"),
    });
    revalidatePath("/admin/preco-ouro");
    return "Preço do ouro registrado.";
  });
}

export async function acaoUsaTamanho(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    const usaTamanho = campo(f, "usaTamanho") === "true";
    await definirUsaTamanho(bdAplicacao(), ator, { id: campo(f, "id"), usaTamanho });
    revalidatePath("/admin/cadastros");
    return usaTamanho ? "A categoria passa a usar tamanho." : "A categoria deixa de usar tamanho.";
  });
}
