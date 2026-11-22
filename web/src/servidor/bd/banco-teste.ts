// Rotina destrutiva dos testes: recria os esquemas do banco de teste.
// Só age em banco cujo nome termina em _teste, conferido duas vezes: na
// cadeia de conexão e no próprio servidor, depois de conectar.

import pg from "pg";
import { nomeDoBanco } from "./conexao";

export class ErroBancoNaoEhDeTeste extends Error {}

export function garantirBancoDeTeste(nome: string): void {
  if (!nome.endsWith("_teste")) {
    throw new ErroBancoNaoEhDeTeste(
      `Operação destrutiva recusada: o banco "${nome}" não termina em _teste.`,
    );
  }
}

/** Apaga os esquemas app e migracao do banco de teste. As migrations são reaplicadas por quem chamou. */
export async function apagarEsquemasDeTeste(urlMigracao: string): Promise<void> {
  garantirBancoDeTeste(nomeDoBanco(urlMigracao));
  const cliente = new pg.Client({ connectionString: urlMigracao });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<{ banco: string }>("select current_database() as banco");
    garantirBancoDeTeste(rows[0].banco);
    await cliente.query("drop schema if exists app cascade; drop schema if exists migracao cascade;");
  } finally {
    await cliente.end();
  }
}
