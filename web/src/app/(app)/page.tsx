import Link from "next/link";
import { Cartao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { temPermissao } from "@/servidor/permissoes";
import { totaisDeVendas } from "@/servidor/servicos/vendas";
import { formatarReais } from "@/web/formatacao";
import { itensDoMenu } from "@/web/menu";
import { exigirAcessoRota } from "@/web/sessao";

const DESCRICOES: Record<string, string> = {
  "/vendas/nova": "Registrar uma venda",
  "/vendas": "Consultar e cancelar vendas",
  "/produtos": "Consultar produtos, saldos e preços",
  "/estoque/movimentar": "Presente, perda, roubo e ajustes",
  "/admin/preco-ouro": "Registrar o preço do grama do ouro",
  "/admin/importacao": "Lotes e pendências da importação das planilhas",
  "/indicadores": "Vendas por mês e estoque por categoria e material",
  "/relatorios": "Painel de indicadores do Data Warehouse",
  "/admin/usuarios": "Criar, editar e desativar usuários",
  "/admin/cadastros": "Materiais, categorias e subcategorias",
  "/admin/configuracoes": "Parâmetros do sistema",
  "/admin/auditoria": "Registro das operações",
};

export default async function PaginaInicial() {
  const ator = await exigirAcessoRota("/");
  // RN-64: só vendas confirmadas da aplicação; as vendas antigas da planilha não entram.
  const totais = temPermissao(ator.perfil, "vendas.consultar") ? await totaisDeVendas(bdAplicacao(), ator) : null;
  const atalhos = itensDoMenu(ator.perfil).filter((item) => item.rota !== "/");
  const primeiroNome = ator.nome.split(" ")[0];
  return (
    <>
      <TituloPagina descricao="Escolha uma das opções abaixo para começar.">Olá, {primeiroNome}!</TituloPagina>
      {totais ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Cartao>
            <p className="text-xs text-texto-suave">Vendas de hoje</p>
            <p className="text-2xl font-semibold">{formatarReais(totais.dia.valor)}</p>
            <p className="text-sm text-texto-suave">{totais.dia.quantidade} {totais.dia.quantidade === 1 ? "venda" : "vendas"}</p>
          </Cartao>
          <Cartao>
            <p className="text-xs text-texto-suave">Vendas do mês</p>
            <p className="text-2xl font-semibold">{formatarReais(totais.mes.valor)}</p>
            <p className="text-sm text-texto-suave">{totais.mes.quantidade} {totais.mes.quantidade === 1 ? "venda" : "vendas"}</p>
          </Cartao>
        </div>
      ) : null}
      {atalhos.length === 0 ? (
        <Cartao>
          <p className="text-sm text-texto-suave">
            Nenhuma tela disponível para o seu perfil.
          </p>
        </Cartao>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {atalhos.map((item) => (
            <li key={item.rota}>
              <Link href={item.rota} className="block h-full">
                <Cartao className="h-full transition-colors hover:border-primaria">
                  <p className="font-medium">{item.rotulo}</p>
                  <p className="mt-1 text-sm text-texto-suave">{DESCRICOES[item.rota]}</p>
                </Cartao>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
