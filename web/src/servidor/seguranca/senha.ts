// RN-03: senhas guardadas apenas como hash Argon2id.

import { hash, verify } from "@node-rs/argon2";

// Parâmetros mínimos recomendados pela OWASP para Argon2id (19 MiB, 2 passagens).
// O algoritmo padrão da biblioteca já é Argon2id; o enum dela é `const enum`,
// que não pode ser importado com isolatedModules. Os testes conferem o prefixo $argon2id$.
const OPCOES = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const TAMANHO_MINIMO_SENHA = 10;

export function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}

let hashDescartavel: Promise<string> | null = null;

/**
 * Faz uma verificação descartável para que um login inexistente leve o mesmo
 * tempo que uma senha errada (RN-01: não revelar qual campo falhou).
 */
export async function igualarTempoDeVerificacao(senha: string): Promise<void> {
  hashDescartavel ??= gerarHashSenha("hash-descartavel-para-igualar-o-tempo");
  await verificarSenha(await hashDescartavel, senha);
}
