// Conexão só de leitura com o Data Warehouse (dw_joalheria, esquema bi), pelo
// papel bi_leitura. Pool separado do banco da aplicação: os gráficos da tela
// Relatórios nunca leem o banco operacional.

import pg from "pg";

// Guardado em globalThis para que o recarregamento do `next dev` não abra um pool novo a cada edição.
const global = globalThis as unknown as { __poolDw?: pg.Pool };

/** Pool do DW, lido de DW_DATABASE_URL; `null` se a variável não estiver definida. */
export function poolDw(): pg.Pool | null {
  const url = process.env.DW_DATABASE_URL;
  if (!url) return null;
  global.__poolDw ??= new pg.Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
    idleTimeoutMillis: 60000,
  });
  return global.__poolDw;
}
