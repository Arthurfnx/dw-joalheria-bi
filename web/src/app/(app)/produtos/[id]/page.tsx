import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoSituacaoProduto } from "@/app/acoes/produtos";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Aviso, Cartao, Etiqueta } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroNaoEncontrado, ErroValidacao } from "@/servidor/erros";
import { temPermissao } from "@/servidor/permissoes";
import { obterProduto } from "@/servidor/servicos/produtos";
import { formatarData, formatarDataHora, formatarDecimal, formatarReais } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Produto" };

const SITUACAO_ORIGEM: Record<string, string> = {
  EM_ESTOQUE: "Em estoque",
  CONSIGNADA: "Consignada",
  VENDIDA: "Vendida",
  PERDIDA: "Perdida",
  REVISAR: "A revisar",
};

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

export default async function PaginaProduto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ator = await exigirAcessoRota("/produtos");
  const { id } = await params;
  const recemCadastrado = (await searchParams).cadastrado === "1";
  let dados;
  try {
    dados = await obterProduto(bdAplicacao(), ator, id);
  } catch (e) {
    if (e instanceof ErroNaoEncontrado || e instanceof ErroValidacao) notFound();
    throw e;
  }
  const { produto: p, movimentacoes, vendasHistoricas, origem, faltaPrecoSugerido, veCustos } = dados;
  const podeGerenciar = temPermissao(ator.perfil, "produtos.gerenciar");
  const podeMovimentar = temPermissao(ator.perfil, "estoque.movimentar");

  return (
    <div className="space-y-4">
      {recemCadastrado && podeGerenciar ? (
        <Aviso tipo="sucesso" className="flex flex-wrap items-center justify-between gap-2">
          <span>Produto cadastrado.</span>
          <Link href="/produtos/novo" className="font-medium underline underline-offset-2">
            Cadastrar outro produto
          </Link>
        </Aviso>
      ) : null}
      <div>
        <Link href="/produtos" className="text-sm text-primaria hover:underline">← Produtos</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words">
          <span className="mr-2 font-mono">{p.codigo}</span>
          {p.descricao}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Etiqueta ativo={p.ativo}>{p.ativo ? "Ativo" : "Inativo"}</Etiqueta>
          {origem ? <Etiqueta ativo={false}>Importado: {SITUACAO_ORIGEM[origem.situacaoOriginal]}</Etiqueta> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao>
          <p className="text-xs text-texto-suave">Saldo</p>
          <p className="text-3xl font-semibold">{p.saldo}</p>
          {p.saldo > 0 ? (
            <p className="text-sm text-texto-suave">
              {p.local_estoque ?? "Sem local"}
              {p.local_estoque === "Consignado" && p.consignado_com ? ` com ${p.consignado_com}` : ""}
            </p>
          ) : (
            <p className="text-sm text-texto-suave">
              Sem saldo{p.local_estoque ? ` · último local: ${p.local_estoque}` : ""}
            </p>
          )}
        </Cartao>
        <Cartao>
          <p className="text-xs text-texto-suave">Preço de venda</p>
          <p className="text-xl font-semibold">{formatarReais(p.preco_venda)}</p>
          <p className="mt-2 text-xs text-texto-suave">Preço sugerido</p>
          {p.precoSugerido ? (
            <p className="text-lg font-medium">{formatarReais(p.precoSugerido)}</p>
          ) : (
            <p className="text-sm text-texto-suave">{faltaPrecoSugerido}</p>
          )}
        </Cartao>
        <Cartao className="flex flex-col gap-2">
          {podeGerenciar ? (
            <Link href={`/produtos/${p.id}/editar`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-borda bg-superficie px-4 text-sm font-medium hover:bg-fundo">
              Editar produto
            </Link>
          ) : null}
          {podeMovimentar && p.ativo ? (
            <Link href={`/estoque/movimentar?produtoId=${p.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-borda bg-superficie px-4 text-sm font-medium hover:bg-fundo">
              Saída ou ajuste
            </Link>
          ) : null}
          {podeGerenciar ? (
            <FormularioAcao
              acao={acaoSituacaoProduto}
              rotuloBotao={p.ativo ? "Desativar" : "Reativar"}
              varianteBotao={p.ativo ? "perigo" : "secundario"}
              className="[&_button[type=submit]]:w-full"
            >
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="ativo" value={p.ativo ? "false" : "true"} />
            </FormularioAcao>
          ) : null}
        </Cartao>
      </div>

      <Cartao>
        <h2 className="mb-3 font-semibold">Dados</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dado rotulo="Material">{p.materialNome}</Dado>
          <Dado rotulo="Categoria">{p.categoriaNome}{p.subcategoriaNome ? ` / ${p.subcategoriaNome}` : ""}</Dado>
          <Dado rotulo="Modo de controle">{p.modo_controle === "UNITARIO" ? "Peça única" : "Quantidade"}</Dado>
          <Dado rotulo="Peso (g)">{formatarDecimal(p.peso_gramas)}</Dado>
          {p.categoriaUsaTamanho ? <Dado rotulo="Tamanho">{p.tamanho ?? "—"}</Dado> : null}
          <Dado rotulo="Índice de preço">{formatarDecimal(p.indice_preco)}</Dado>
          <Dado rotulo="Pedras">{p.pedras ?? "—"}</Dado>
          <Dado rotulo="Estoque mínimo">{p.estoque_minimo ?? "—"}</Dado>
          {veCustos ? (
            <>
              <Dado rotulo="Valor de aquisição">{formatarReais(p.valor_aquisicao)}</Dado>
              <Dado rotulo="Data de aquisição">{formatarData(p.data_aquisicao)}</Dado>
            </>
          ) : null}
          {p.observacao ? <Dado rotulo="Observação">{p.observacao}</Dado> : null}
        </dl>
        {origem ? (
          <p className="mt-3 text-xs text-texto-suave break-words">
            Origem: {origem.arquivo}, aba {origem.aba}, linha {origem.linha}
            {veCustos && origem.localOriginal ? ` · local na planilha: ${origem.localOriginal}` : ""}
            {origem.tamanhoOriginal ? ` · tamanho na planilha: ${origem.tamanhoOriginal}` : ""}
          </p>
        ) : null}
      </Cartao>

      <Cartao>
        <h2 className="mb-3 font-semibold">Movimentações</h2>
        {movimentacoes.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhuma movimentação.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {movimentacoes.map((m) => (
              <li key={m.id} className="py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-medium">{m.tipo}</span>
                  <span>{m.sinal > 0 ? "+" : "−"}{m.quantidade} · saldo após: {m.saldoApos}</span>
                </div>
                <p className="text-xs text-texto-suave break-words">
                  Ocorrência em {formatarData(m.dataOcorrencia)} · registrada em {formatarDataHora(m.registradaEm)} por {m.usuarioNome}
                  {veCustos && m.custoUnitario ? ` · custo ${formatarReais(m.custoUnitario)}` : ""}
                  {m.motivo ? ` · motivo: ${m.motivo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {vendasHistoricas.length > 0 ? (
        <Cartao>
          <h2 className="font-semibold">Vendas anteriores (planilha)</h2>
          <p className="mb-3 text-xs text-texto-suave">Registradas antes da aplicação: não têm número de venda.</p>
          <ul className="divide-y divide-borda">
            {vendasHistoricas.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
                <span>{formatarData(v.dataVenda)}</span>
                <span>
                  {formatarReais(v.valorVenda)}
                  {v.simbolico ? " (simbólico)" : ""}
                  {veCustos && v.valorCompra ? ` · compra ${formatarReais(v.valorCompra)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      {!p.ativo ? <Aviso tipo="info">Produto inativo: não pode ser vendido nem movimentado.</Aviso> : null}
    </div>
  );
}
