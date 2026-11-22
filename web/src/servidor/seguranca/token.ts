// RN-05: o token de sessão é aleatório e só o seu hash é guardado no banco.

import { createHash, randomBytes } from "node:crypto";

export function gerarTokenSessao(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
