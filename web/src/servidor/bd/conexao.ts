// Conexão da aplicação com o banco, sempre pelo papel nobreza_aplicacao.

import { Kysely, PostgresDialect, type Transaction } from "kysely";
import pg from "pg";
import { variavelObrigatoria } from "../ambiente";
import type { BancoApp } from "./tipos";

// Datas de negócio (tipo date) ficam como texto AAAA-MM-DD. Convertidas em Date,
// ganhariam o fuso do servidor e poderiam virar o dia anterior.
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);

export type Bd = Kysely<BancoApp>;
export type Trx = Transaction<BancoApp>;

export function criarBd(url: string, maxConexoes = 10): Bd {
  return new Kysely<BancoApp>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: url, max: maxConexoes }),
    }),
  });
}

// Guardado em globalThis para que o recarregamento do `next dev` não abra um pool novo a cada edição.
const global = globalThis as unknown as { __bdNobreza?: Bd };

/** Banco da aplicação, lido de DATABASE_URL. */
export function bdAplicacao(): Bd {
  global.__bdNobreza ??= criarBd(variavelObrigatoria("DATABASE_URL"));
  return global.__bdNobreza;
}

/** Nome do banco de uma cadeia de conexão postgresql://…/banco. */
export function nomeDoBanco(url: string): string {
  const caminho = new URL(url).pathname.replace(/^\//, "");
  return decodeURIComponent(caminho);
}
