"use server";

// Ações das telas de administração. A permissão de cada uma é verificada
// pela camada de servidor; aqui só se lê o formulário e se atualiza a tela.

import { revalidatePath } from "next/cache";
import { bdAplicacao } from "@/servidor/bd/conexao";
import {
  criarCadastro,
  definirSituacaoCadastro,
  renomearCadastro,
} from "@/servidor/servicos/cadastros";
import { alterarConfiguracao } from "@/servidor/servicos/configuracoes";
import {
  criarUsuario,
  desativarUsuario,
  editarUsuario,
  reativarUsuario,
  redefinirSenha,
} from "@/servidor/servicos/usuarios";
import { campo, executarAcao } from "@/web/acao";
import type { EstadoAcao } from "@/web/estado-acao";

// ---------- Usuários ----------

export async function acaoCriarUsuario(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await criarUsuario(bdAplicacao(), ator, {
      nome: campo(f, "nome"),
      login: campo(f, "login"),
      perfil: campo(f, "perfil"),
      senha: campo(f, "senha"),
    });
    revalidatePath("/admin/usuarios");
    return "Usuário criado. No primeiro acesso, ele precisará trocar a senha.";
  });
}

export async function acaoEditarUsuario(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await editarUsuario(bdAplicacao(), ator, {
      id: campo(f, "id"),
      nome: campo(f, "nome"),
      perfil: campo(f, "perfil"),
    });
    revalidatePath("/admin/usuarios");
    return "Usuário atualizado.";
  });
}

export async function acaoDesativarUsuario(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await desativarUsuario(bdAplicacao(), ator, campo(f, "id"));
    revalidatePath("/admin/usuarios");
    return "Usuário desativado e sessões encerradas.";
  });
}

export async function acaoReativarUsuario(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await reativarUsuario(bdAplicacao(), ator, campo(f, "id"));
    revalidatePath("/admin/usuarios");
    return "Usuário reativado.";
  });
}

export async function acaoRedefinirSenha(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await redefinirSenha(bdAplicacao(), ator, { id: campo(f, "id"), senha: campo(f, "senha") });
    revalidatePath("/admin/usuarios");
    return "Senha redefinida. O usuário precisará trocá-la no próximo acesso.";
  });
}

// ---------- Cadastros de domínio ----------

export async function acaoCriarCadastro(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    const categoriaId = campo(f, "categoriaId");
    await criarCadastro(bdAplicacao(), ator, {
      tipo: campo(f, "tipo"),
      nome: campo(f, "nome"),
      categoriaId: categoriaId === "" ? undefined : categoriaId,
      usaTamanho: campo(f, "tipo") === "categoria" ? campo(f, "usaTamanho") === "true" : undefined,
    });
    revalidatePath("/admin/cadastros");
    return "Cadastro incluído.";
  });
}

export async function acaoRenomearCadastro(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await renomearCadastro(bdAplicacao(), ator, {
      tipo: campo(f, "tipo"),
      id: campo(f, "id"),
      nome: campo(f, "nome"),
    });
    revalidatePath("/admin/cadastros");
    return "Nome alterado.";
  });
}

export async function acaoSituacaoCadastro(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    const ativo = campo(f, "ativo") === "true";
    await definirSituacaoCadastro(bdAplicacao(), ator, { tipo: campo(f, "tipo"), id: campo(f, "id"), ativo });
    revalidatePath("/admin/cadastros");
    return ativo ? "Item reativado." : "Item desativado.";
  });
}

// ---------- Configurações ----------

export async function acaoAlterarConfiguracao(_anterior: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  return executarAcao(async (ator) => {
    await alterarConfiguracao(bdAplicacao(), ator, { chave: campo(f, "chave"), valor: campo(f, "valor") });
    revalidatePath("/admin/configuracoes");
    return "Parâmetro atualizado.";
  });
}
