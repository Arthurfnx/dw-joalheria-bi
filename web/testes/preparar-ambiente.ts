// Carrega web/.env antes dos testes, se existir.

import { existsSync } from "node:fs";
import path from "node:path";

const arquivo = path.resolve(__dirname, "..", ".env");
if (existsSync(arquivo)) process.loadEnvFile(arquivo);
