// Itens de navegação por perfil. A lista vem da mesma matriz de permissões
// que protege as rotas, para que menu e acesso nunca divirjam.

import { permissaoDaRota, temPermissao, type Perfil } from "@/servidor/permissoes";

const ITENS = [
  { rota: "/", rotulo: "Início" },
  { rota: "/vendas/nova", rotulo: "Nova venda" },
  { rota: "/vendas", rotulo: "Vendas" },
  { rota: "/produtos", rotulo: "Produtos" },
  { rota: "/estoque/movimentar", rotulo: "Saída ou ajuste" },
  { rota: "/relatorios", rotulo: "Relatórios" },
  { rota: "/admin/preco-ouro", rotulo: "Preço do ouro" },
  { rota: "/admin/importacao", rotulo: "Importação" },
  { rota: "/admin/usuarios", rotulo: "Usuários" },
  { rota: "/admin/cadastros", rotulo: "Cadastros" },
  { rota: "/admin/configuracoes", rotulo: "Configurações" },
  { rota: "/admin/auditoria", rotulo: "Auditoria" },
] as const;

export function itensDoMenu(perfil: Perfil): { rota: string; rotulo: string }[] {
  return ITENS.filter((item) => temPermissao(perfil, permissaoDaRota(item.rota))).map((i) => ({ ...i }));
}
