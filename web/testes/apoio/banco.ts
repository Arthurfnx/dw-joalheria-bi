// Apoio aos testes de integração. A aplicação conecta como nobreza_aplicacao
// (DATABASE_URL_TESTE); o dono do esquema (DATABASE_URL_TESTE_MIGRACAO) só é
// usado para recriar o esquema e para os casos que testam o próprio dono.

import path from "node:path";
import { criarBd, nomeDoBanco, type Bd } from "@/servidor/bd/conexao";
import { apagarEsquemasDeTeste, garantirBancoDeTeste } from "@/servidor/bd/banco-teste";
import { aplicarMigracoes } from "@/servidor/bd/migracoes";
import type { Ator, Perfil } from "@/servidor/permissoes";
import { entrar, trocarSenha } from "@/servidor/servicos/acesso";
import { criarAdministradorInicial, criarUsuario } from "@/servidor/servicos/usuarios";

export const PASTA_MIGRACOES = path.resolve(__dirname, "..", "..", "db", "migrations");

function url(nome: "DATABASE_URL_TESTE" | "DATABASE_URL_TESTE_MIGRACAO"): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} não está definida: os testes de integração precisam do banco nobreza_app_teste (veja web/.env.example).`,
    );
  }
  garantirBancoDeTeste(nomeDoBanco(valor));
  return valor;
}

export const urlAplicacaoTeste = () => url("DATABASE_URL_TESTE");
export const urlMigracaoTeste = () => url("DATABASE_URL_TESTE_MIGRACAO");

/** Recria os esquemas do banco de teste e aplica todas as migrations. */
export async function recriarBancoDeTeste(): Promise<void> {
  await apagarEsquemasDeTeste(urlMigracaoTeste());
  await aplicarMigracoes({ url: urlMigracaoTeste(), pasta: PASTA_MIGRACOES });
}

export function conectarComoAplicacao(): Bd {
  return criarBd(urlAplicacaoTeste(), 5);
}

/** Papel de leitura do DW no banco de teste: a mesma cadeia de DATABASE_URL_LEITURA_DW, trocando só o banco. */
export function conectarComoLeituraDw(): Bd {
  const valor = process.env.DATABASE_URL_LEITURA_DW;
  if (!valor) throw new Error("DATABASE_URL_LEITURA_DW não está definida (veja web/.env.example).");
  const url = new URL(valor);
  url.pathname = "/" + nomeDoBanco(urlAplicacaoTeste());
  garantirBancoDeTeste(nomeDoBanco(url.toString()));
  return criarBd(url.toString(), 2);
}

export function conectarComoDono(): Bd {
  return criarBd(urlMigracaoTeste(), 2);
}

export const SENHA_PADRAO = "senha-de-teste-123";
export const SENHA_DEFINITIVA = "senha-definitiva-456";

let sequencia = 0;
export function nomeUnico(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}${Date.now().toString(36)}${sequencia}`.toLowerCase();
}

/** Primeiro administrador do banco recém-criado, já com sessão. */
export async function criarAdministradorDeTeste(bd: Bd): Promise<{ ator: Ator; login: string; senha: string }> {
  const login = nomeUnico("admin");
  await criarAdministradorInicial(bd, { nome: "Administrador de Teste", login, senha: SENHA_PADRAO });
  const { ator } = await entrar(bd, { login, senha: SENHA_PADRAO });
  return { ator, login, senha: SENHA_PADRAO };
}

/** Usuário criado pelo administrador e com a troca obrigatória já feita. */
export async function criarUsuarioPronto(
  bd: Bd,
  admin: Ator,
  perfil: Perfil,
): Promise<{ ator: Ator; login: string; senha: string; token: string }> {
  const login = nomeUnico(perfil === "ADMINISTRADOR" ? "adm" : "vend");
  await criarUsuario(bd, admin, { nome: `Usuário ${login}`, login, perfil, senha: SENHA_PADRAO });
  const primeiro = await entrar(bd, { login, senha: SENHA_PADRAO });
  await trocarSenha(bd, primeiro.ator, {
    senhaAtual: SENHA_PADRAO,
    novaSenha: SENHA_DEFINITIVA,
    confirmacao: SENHA_DEFINITIVA,
  });
  const { ator, token } = await entrar(bd, { login, senha: SENHA_DEFINITIVA });
  return { ator, login, senha: SENHA_DEFINITIVA, token };
}
