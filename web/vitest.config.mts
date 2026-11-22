import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["testes/**/*.test.ts"],
    setupFiles: ["testes/preparar-ambiente.ts"],
    // Os testes de integração recriam o esquema do banco de teste: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
