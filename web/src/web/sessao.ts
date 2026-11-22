// Ponte entre o Next.js (cookies, cabeçalhos, redirecionamentos) e a camada de servidor.
// Só é importado por telas e ações de servidor (usa next/headers).

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { permissaoDaRota, temPermissao, type Ator } from "@/servidor/permissoes";
import { cookieDeveSerSeguro } from "@/servidor/seguranca/origem";
import { DIAS_DURACAO_MAXIMA_SESSAO, validarSessao } from "@/servidor/servicos/acesso";

export const NOME_COOKIE_SESSAO = "nj_sessao";

export async function lerTokenSessao(): Promise<string | undefined> {
  return (await cookies()).get(NOME_COOKIE_SESSAO)?.value;
}

/** Valida a sessão uma vez por requisição, mesmo que layout e página perguntem. */
export const obterAtor = cache(async (): Promise<Ator | null> => {
  return validarSessao(bdAplicacao(), await lerTokenSessao());
});

/** Exige sessão válida e, salvo na própria tela de troca, a senha já trocada (RN-04, RN-05). */
export async function exigirAtor(opcoes: { permitirTrocaPendente?: boolean } = {}): Promise<Ator> {
  const ator = await obterAtor();
  if (!ator) redirect("/login");
  if (ator.deveTrocarSenha && !opcoes.permitirTrocaPendente) redirect("/trocar-senha");
  return ator;
}

/** RN-06: verifica no servidor a permissão da rota antes de montar a tela. */
export async function exigirAcessoRota(rota: string): Promise<Ator> {
  const ator = await exigirAtor();
  if (!temPermissao(ator.perfil, permissaoDaRota(rota))) redirect("/acesso-negado");
  return ator;
}

export async function gravarCookieSessao(token: string): Promise<void> {
  const host = (await headers()).get("host");
  (await cookies()).set(NOME_COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieDeveSerSeguro(process.env.NODE_ENV, host),
    path: "/",
    maxAge: DIAS_DURACAO_MAXIMA_SESSAO * 24 * 60 * 60,
  });
}

export async function apagarCookieSessao(): Promise<void> {
  (await cookies()).delete(NOME_COOKIE_SESSAO);
}
