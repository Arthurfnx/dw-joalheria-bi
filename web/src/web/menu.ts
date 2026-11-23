// Itens de navegação por perfil. A lista vem da mesma matriz de permissões
// que protege as rotas, para que menu e acesso nunca divirjam.

import { permissaoDaRota, temPermissao, type Perfil } from "@/servidor/permissoes";

const ITENS = [
  { rota: "/", rotulo: "Início" },
  { rota: "/vendas/nova", rotulo: "Nova venda" },
  { rota: "/vendas", rotulo: "Vendas" },
  { rota: "/produtos", rotulo: "Produtos" },
  { rota: "/produtos/novo", rotulo: "Cadastrar produto" },
  { rota: "/estoque/movimentar", rotulo: "Saída ou ajuste" },
  { rota: "/indicadores", rotulo: "Indicadores" },
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

// Botões de ação rápida da tela Início. Cada um só aparece se o perfil tem a
// permissão da rota, a mesma regra do menu.
const ACOES_RAPIDAS = [
  { rota: "/vendas/nova", rotulo: "+ Nova venda" },
  { rota: "/produtos/novo", rotulo: "+ Cadastrar produto" },
] as const;

export function acoesRapidasDaInicio(perfil: Perfil): { rota: string; rotulo: string }[] {
  return ACOES_RAPIDAS.filter((acao) => temPermissao(perfil, permissaoDaRota(acao.rota))).map((a) => ({ ...a }));
}

// Cartões da tela Início: os itens do menu, sem a própria Início e sem as rotas
// que o perfil já vê como botão no topo, para não repetir o mesmo atalho.
export function atalhosDaInicio(perfil: Perfil): { rota: string; rotulo: string }[] {
  const rotasDosBotoes = new Set(acoesRapidasDaInicio(perfil).map((a) => a.rota));
  return itensDoMenu(perfil).filter((item) => item.rota !== "/" && !rotasDosBotoes.has(item.rota));
}
