"use server";

import { redirect } from "next/navigation";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { entrar, sair, trocarSenha } from "@/servidor/servicos/acesso";
import { campo, exigirMesmaOrigem, traduzirErro } from "@/web/acao";
import { estadoErro, type EstadoAcao } from "@/web/estado-acao";
import { apagarCookieSessao, gravarCookieSessao, lerTokenSessao, obterAtor } from "@/web/sessao";

export async function acaoEntrar(_anterior: EstadoAcao, formulario: FormData): Promise<EstadoAcao> {
  let destino: string;
  try {
    await exigirMesmaOrigem();
    const { token, ator } = await entrar(bdAplicacao(), {
      login: campo(formulario, "login"),
      senha: campo(formulario, "senha"),
    });
    await gravarCookieSessao(token);
    destino = ator.deveTrocarSenha ? "/trocar-senha" : "/";
  } catch (erro) {
    return traduzirErro(erro);
  }
  // redirect lança um sinal do Next.js: fica fora do try para não ser tratado como erro.
  redirect(destino);
}

export async function acaoSair(): Promise<void> {
  await exigirMesmaOrigem();
  await sair(bdAplicacao(), await lerTokenSessao());
  await apagarCookieSessao();
  redirect("/login");
}

export async function acaoTrocarSenha(_anterior: EstadoAcao, formulario: FormData): Promise<EstadoAcao> {
  try {
    await exigirMesmaOrigem();
    const ator = await obterAtor();
    if (!ator) return estadoErro("Sessão encerrada. Entre novamente.");
    await trocarSenha(bdAplicacao(), ator, {
      senhaAtual: campo(formulario, "senhaAtual"),
      novaSenha: campo(formulario, "novaSenha"),
      confirmacao: campo(formulario, "confirmacao"),
    });
  } catch (erro) {
    return traduzirErro(erro);
  }
  redirect("/");
}
