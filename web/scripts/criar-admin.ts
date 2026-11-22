// npm run usuario:criar-admin — cria o primeiro administrador (RN-07).
// Nome e login são pedidos no terminal; a senha é digitada sem eco e nunca
// passa por argumento de linha de comando nem por arquivo.

import { createInterface } from "node:readline/promises";
import { carregarEnv } from "./carregar-env";
import { variavelObrigatoria } from "../src/servidor/ambiente";
import { criarBd } from "../src/servidor/bd/conexao";
import { ErroAplicacao } from "../src/servidor/erros";
import { criarAdministradorInicial } from "../src/servidor/servicos/usuarios";

function perguntarOculto(pergunta: string): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const entrada = process.stdin;
    process.stdout.write(pergunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    let valor = "";
    const aoReceber = (bloco: string) => {
      for (const caractere of bloco) {
        if (caractere === "\r" || caractere === "\n") {
          encerrar();
          process.stdout.write("\n");
          resolver(valor);
          return;
        }
        if (caractere === "\u0003") {
          encerrar();
          process.stdout.write("\n");
          rejeitar(new Error("Cancelado pelo usuário."));
          return;
        }
        if (caractere === "\u0008" || caractere === "\u007f") {
          valor = valor.slice(0, -1);
        } else if (caractere >= " ") {
          valor += caractere;
        }
      }
    };
    const encerrar = () => {
      entrada.off("data", aoReceber);
      entrada.setRawMode(false);
      entrada.pause();
    };
    entrada.on("data", aoReceber);
  });
}

async function principal(): Promise<void> {
  carregarEnv();
  if (!process.stdin.isTTY) {
    throw new Error("Execute este comando num terminal interativo: a senha é digitada sem eco.");
  }
  const url = variavelObrigatoria("DATABASE_URL");

  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const nome = await leitor.question("Nome do administrador: ");
  const login = await leitor.question("Login (minúsculas, 3 a 40 caracteres): ");
  leitor.close();

  const senha = await perguntarOculto("Senha (mínimo de 10 caracteres): ");
  const confirmacao = await perguntarOculto("Repita a senha: ");
  if (senha !== confirmacao) throw new Error("As senhas não conferem. Nada foi gravado.");

  const bd = criarBd(url, 1);
  try {
    const id = await criarAdministradorInicial(bd, { nome, login, senha });
    console.log(`Administrador criado (id ${id}). Entre na aplicação com o login informado.`);
  } finally {
    await bd.destroy();
  }
}

principal().catch((erro: unknown) => {
  const mensagem = erro instanceof ErroAplicacao || erro instanceof Error ? erro.message : String(erro);
  console.error(`ERRO: ${mensagem}`);
  process.exitCode = 1;
});
