// Matriz de permissões por perfil (especificação, seção 2). Verificada na
// camada de servidor em toda operação; a interface só esconde o que não pode.

import { ErroPermissao } from "./erros";

export const PERFIS = ["ADMINISTRADOR", "VENDEDOR"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERMISSOES = [
  "inicio.ver",
  "senha.trocar",
  "relatorios.ver",
  "usuarios.gerenciar",
  "cadastros.gerenciar",
  "configuracoes.gerenciar",
  "auditoria.consultar",
  "produtos.consultar",
  "produtos.gerenciar",
  "estoque.movimentar",
  "custos.ver",
  "preco_ouro.gerenciar",
  "importacao.consultar",
  "vendas.registrar",
  "vendas.consultar",
  "vendas.cancelar",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

const MATRIZ: Record<Perfil, ReadonlySet<Permissao>> = {
  ADMINISTRADOR: new Set(PERMISSOES),
  // Seção 2: o vendedor consulta produtos e saldos, sem custos nem consignado_com.
  // Registra vendas e consulta todas; cancelar é só do administrador (RN-45).
  VENDEDOR: new Set<Permissao>([
    "inicio.ver",
    "senha.trocar",
    "produtos.consultar",
    "vendas.registrar",
    "vendas.consultar",
  ]),
};

export interface Ator {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
}

export function temPermissao(perfil: Perfil, permissao: Permissao): boolean {
  return MATRIZ[perfil]?.has(permissao) ?? false;
}

/**
 * Lança ErroPermissao se o ator não puder executar a operação. Enquanto a
 * troca obrigatória de senha estiver pendente (RN-04), só a própria troca é aceita.
 */
export function exigirPermissao(ator: Ator, permissao: Permissao): void {
  if (ator.deveTrocarSenha && permissao !== "senha.trocar") {
    throw new ErroPermissao("Troque a sua senha antes de continuar.");
  }
  if (!temPermissao(ator.perfil, permissao)) {
    throw new ErroPermissao();
  }
}

/** Rotas protegidas por permissão específica. As demais exigem apenas sessão. */
const PERMISSAO_POR_ROTA: ReadonlyArray<readonly [string, Permissao]> = [
  ["/admin/usuarios", "usuarios.gerenciar"],
  ["/admin/cadastros", "cadastros.gerenciar"],
  ["/admin/configuracoes", "configuracoes.gerenciar"],
  ["/admin/auditoria", "auditoria.consultar"],
  ["/admin/preco-ouro", "preco_ouro.gerenciar"],
  ["/admin/importacao", "importacao.consultar"],
  ["/produtos/novo", "produtos.gerenciar"],
  ["/estoque/movimentar", "estoque.movimentar"],
  ["/produtos", "produtos.consultar"],
  ["/vendas/nova", "vendas.registrar"],
  ["/vendas", "vendas.consultar"],
  ["/relatorios", "relatorios.ver"],
];

/**
 * Permissão exigida por uma rota. Qualquer rota sob /admin que não esteja
 * listada exige a permissão de gestão de usuários, para que uma tela nova
 * de administração nunca nasça aberta ao vendedor.
 */
export function permissaoDaRota(caminho: string): Permissao {
  if (/^\/produtos\/[^/]+\/editar\/?$/.test(caminho)) return "produtos.gerenciar";
  for (const [prefixo, permissao] of PERMISSAO_POR_ROTA) {
    if (caminho === prefixo || caminho.startsWith(prefixo + "/")) return permissao;
  }
  if (caminho === "/admin" || caminho.startsWith("/admin/")) return "usuarios.gerenciar";
  return "inicio.ver";
}
