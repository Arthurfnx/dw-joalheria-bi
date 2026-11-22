// npm run db:migrar — aplica as migrations pendentes em nobreza_app, com o papel nobreza_migracao.

import path from "node:path";
import { carregarEnv } from "./carregar-env";
import { variavelObrigatoria } from "../src/servidor/ambiente";
import { nomeDoBanco } from "../src/servidor/bd/conexao";
import { aplicarMigracoes } from "../src/servidor/bd/migracoes";

async function principal(): Promise<void> {
  carregarEnv();
  const url = variavelObrigatoria("DATABASE_URL_MIGRACAO");
  const pasta = path.resolve(process.cwd(), "db", "migrations");
  console.log(`Banco: ${nomeDoBanco(url)}`);
  const resultado = await aplicarMigracoes({ url, pasta, registrar: (m) => console.log(m) });
  if (resultado.aplicadas.length === 0) {
    console.log(`Nada a fazer: as ${resultado.jaAplicadas} migrations já estavam aplicadas.`);
  } else {
    console.log(`${resultado.aplicadas.length} migration(s) aplicada(s).`);
  }
}

principal().catch((erro: unknown) => {
  console.error(`ERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
