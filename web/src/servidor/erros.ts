// Erros de negócio que a camada web traduz em mensagem para a tela.
// Qualquer outro erro é tratado como falha interna, sem detalhes ao usuário.

export class ErroAplicacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Entrada inválida (formato, tamanho, campo obrigatório). */
export class ErroValidacao extends ErroAplicacao {}

/** Regra de negócio violada (nome duplicado, último administrador etc.). */
export class ErroNegocio extends ErroAplicacao {}

/** Perfil sem permissão para a operação (RN-06). */
export class ErroPermissao extends ErroAplicacao {
  constructor(mensagem = "Acesso negado: o seu perfil não permite esta operação.") {
    super(mensagem);
  }
}

/** Sessão ausente, expirada ou revogada (RN-05). */
export class ErroSessao extends ErroAplicacao {
  constructor(mensagem = "Sessão encerrada. Entre novamente.") {
    super(mensagem);
  }
}

/** Mensagem única de RN-01: não revela qual campo falhou. */
export const MENSAGEM_CREDENCIAIS_INVALIDAS = "Login ou senha inválidos.";

export class ErroCredenciais extends ErroAplicacao {
  constructor() {
    super(MENSAGEM_CREDENCIAIS_INVALIDAS);
  }
}

export class ErroNaoEncontrado extends ErroAplicacao {}

/** Código de violação de unicidade do PostgreSQL. */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as { code?: unknown }).code === "23505";
}

/**
 * Erros de negócio sinalizados pelas funções do banco (NJ001 a NJ007, seção 4.4)
 * e pelas restrições das tabelas. A mensagem do banco já está em português e
 * não contém dados pessoais; erros sem código conhecido continuam internos.
 */
export function traduzirErroBanco(erro: unknown): unknown {
  if (typeof erro !== "object" || erro === null) return erro;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (typeof code === "string" && /^NJ00[1-7]$/.test(code) && typeof message === "string") {
    return code === "NJ004" ? new ErroPermissao(message) : new ErroNegocio(message);
  }
  if (code === "23505") return new ErroNegocio("Já existe um registro com este valor.");
  if (code === "23514") return new ErroValidacao("Algum valor informado não é aceito.");
  return erro;
}
