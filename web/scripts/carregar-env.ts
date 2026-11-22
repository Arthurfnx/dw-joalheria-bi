// Carrega web/.env para os comandos de linha, se existir. Variáveis já
// definidas no ambiente têm precedência (comportamento do próprio Node.js).

import { existsSync } from "node:fs";
import path from "node:path";

export function carregarEnv(): void {
  const arquivo = path.resolve(process.cwd(), ".env");
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}
