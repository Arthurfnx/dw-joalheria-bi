// Validação de entrada da camada de servidor. Toda operação valida o que
// recebe, mesmo que a tela já tenha validado.

import { z } from "zod";
import { ErroValidacao } from "./erros";
import { PERFIS } from "./permissoes";
import { TAMANHO_MINIMO_SENHA } from "./seguranca/senha";

/** Converte o primeiro erro do Zod numa ErroValidacao com mensagem em português. */
export function validar<T extends z.ZodType>(esquema: T, entrada: unknown): z.output<T> {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    throw new ErroValidacao(resultado.error.issues[0]?.message ?? "Dados inválidos.");
  }
  return resultado.data;
}

const texto = (rotulo: string) =>
  z.string({ error: `Informe ${rotulo}.` });

export const esquemaId = z
  .union([z.string(), z.number()], { error: "Identificador inválido." })
  .transform((v) => String(v).trim())
  .refine((v) => /^[1-9]\d{0,18}$/.test(v), { error: "Identificador inválido." });

export const esquemaNomePessoa = texto("o nome")
  .trim()
  .min(1, { error: "Informe o nome." })
  .max(120, { error: "O nome deve ter no máximo 120 caracteres." });

/** O login é gravado em minúsculas e segue a restrição da tabela usuario. */
export const esquemaLogin = texto("o login")
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, {
    error: "O login deve ter de 3 a 40 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.",
  });

export const esquemaSenhaNova = z
  .string({ error: "Informe a senha." })
  .min(TAMANHO_MINIMO_SENHA, {
    error: `A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
  })
  // Limite alto só para não aceitar entradas absurdas no cálculo do hash.
  .max(200, { error: "A senha deve ter no máximo 200 caracteres." });

export const esquemaPerfil = z.enum(PERFIS, { error: "Perfil inválido." });

export const esquemaNomeCadastro = texto("o nome")
  .trim()
  .min(1, { error: "Informe o nome." })
  .max(80, { error: "O nome deve ter no máximo 80 caracteres." });

export const esquemaLoginEntrada = z.object({
  // No login não se valida o formato: qualquer erro recebe a mesma mensagem (RN-01).
  login: z.string().trim().toLowerCase().max(200).default(""),
  senha: z.string().max(200).default(""),
});

export const esquemaCriarUsuario = z.object({
  nome: esquemaNomePessoa,
  login: esquemaLogin,
  perfil: esquemaPerfil,
  senha: esquemaSenhaNova,
});

export const esquemaEditarUsuario = z.object({
  id: esquemaId,
  nome: esquemaNomePessoa,
  perfil: esquemaPerfil,
});

export const esquemaRedefinirSenha = z.object({
  id: esquemaId,
  senha: esquemaSenhaNova,
});

export const esquemaTrocarSenha = z
  .object({
    senhaAtual: z.string({ error: "Informe a senha atual." }).min(1, { error: "Informe a senha atual." }),
    novaSenha: esquemaSenhaNova,
    confirmacao: z.string({ error: "Confirme a nova senha." }),
  })
  .refine((d) => d.novaSenha === d.confirmacao, { error: "A confirmação não confere com a nova senha." })
  .refine((d) => d.novaSenha !== d.senhaAtual, { error: "A nova senha deve ser diferente da atual." });

const esquemaData = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Data inválida." });

const vazioParaIndefinido = (v: unknown) => (v === "" || v === null ? undefined : v);

export const esquemaFiltroAuditoria = z
  .object({
    de: z.preprocess(vazioParaIndefinido, esquemaData.optional()),
    ate: z.preprocess(vazioParaIndefinido, esquemaData.optional()),
    usuarioId: z.preprocess(vazioParaIndefinido, esquemaId.optional()),
    entidade: z.preprocess(
      vazioParaIndefinido,
      z.string().trim().max(40).regex(/^[a-z_]+$/, { error: "Entidade inválida." }).optional(),
    ),
  })
  .refine((f) => !f.de || !f.ate || f.de <= f.ate, {
    error: "A data inicial deve ser anterior ou igual à final.",
  });

/**
 * Valor em reais como texto: aceita "1.234,56", "1234,56" e "1234.56" e
 * devolve "1234.56". Nunca passa por número de ponto flutuante.
 */
export const esquemaDinheiro = z
  .string({ error: "Informe o valor." })
  .trim()
  .transform((v) => v.replace(/^R\$\s*/i, ""))
  .transform((v) => (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), { error: "Valor inválido: use reais com até 2 casas decimais." });

export const esquemaDataNegocio = z
  .string({ error: "Informe a data." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Data inválida." });
