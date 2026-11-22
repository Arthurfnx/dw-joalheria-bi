import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Botao, Cartao, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { LIMITE_OCORRENCIAS, listarLotes, listarOcorrencias } from "@/servidor/servicos/importacao";
import { formatarDataHora } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Importação" };

type Parametros = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const COLUNAS = [
  ["lidas", "Lidas"],
  ["importadas", "Importadas"],
  ["rejeitadas", "Rejeitadas"],
  ["em_estoque", "Em estoque"],
  ["consignadas", "Consignadas"],
  ["vendidas", "Vendidas"],
  ["perdidas", "Perdidas"],
  ["a_revisar", "A revisar"],
  ["vendas_historicas", "Vendas históricas"],
] as const;

export default async function PaginaImportacao({ searchParams }: { searchParams: Promise<Parametros> }) {
  const ator = await exigirAcessoRota("/admin/importacao");
  const p = await searchParams;
  const lotes = await listarLotes(bdAplicacao(), ator);
  const loteId = texto(p.lote) || lotes[0]?.id || "";
  const tipo = texto(p.tipo);
  const lote = lotes.find((l) => l.id === loteId);
  const ocorrencias = lote ? await listarOcorrencias(bdAplicacao(), ator, { loteId, tipo }) : null;

  return (
    <>
      <TituloPagina descricao="Lotes da importação das planilhas e as linhas rejeitadas ou a revisar.">Importação</TituloPagina>
      {lotes.length === 0 ? (
        <Cartao>
          <p className="text-sm text-texto-suave">Nenhuma importação foi feita. Ela é executada pelo comando npm run importar:planilhas.</p>
        </Cartao>
      ) : null}

      {lote ? (
        <div className="space-y-4">
          <Cartao>
            <h2 className="font-semibold">Lote {lote.id}</h2>
            <p className="mb-3 text-xs break-words text-texto-suave">
              {lote.arquivo} · {formatarDataHora(lote.iniciadoEm)} por {lote.usuarioNome}
              {lote.concluidoEm ? "" : " · não concluído"}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(lote.contagens).map(([aba, c]) => (
                <div key={aba} className="min-w-0 rounded-md border border-borda p-3">
                  <p className="mb-2 text-sm font-medium break-words">{aba}</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {COLUNAS.map(([chave, rotulo]) => (
                      <div key={chave} className="contents">
                        <dt className="text-texto-suave">{rotulo}</dt>
                        <dd className="text-right">{c[chave] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <form method="get" className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="lote" value={lote.id} />
              <GrupoCampo rotulo="Tipo" htmlFor="tipo">
                <Selecao id="tipo" name="tipo" defaultValue={tipo}>
                  <option value="">Todas</option>
                  <option value="REJEITADA">Rejeitadas</option>
                  <option value="REVISAR">A revisar</option>
                </Selecao>
              </GrupoCampo>
              <Botao type="submit" variante="secundario">Filtrar</Botao>
            </form>
            {ocorrencias?.limiteAtingido ? (
              <Aviso tipo="alerta" className="mb-3">Mostrando as {LIMITE_OCORRENCIAS} primeiras. Filtre por tipo para ver as demais.</Aviso>
            ) : null}
            {ocorrencias && ocorrencias.ocorrencias.length === 0 ? (
              <p className="text-sm text-texto-suave">Nenhuma ocorrência.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {ocorrencias?.ocorrencias.map((o) => (
                  <li key={o.id} className="py-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <span className="font-medium">{o.motivo}</span>
                      <span className={o.tipo === "REJEITADA" ? "text-perigo" : "text-aviso"}>
                        {o.tipo === "REJEITADA" ? "Rejeitada" : "A revisar"}
                      </span>
                    </div>
                    <p className="text-xs break-words text-texto-suave">
                      {o.aba}, linha {o.linha}
                      {o.codigo ? ` · código ${o.codigo}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {lotes.length > 1 ? (
            <Cartao>
              <h2 className="mb-2 font-semibold">Outros lotes</h2>
              <ul className="space-y-1 text-sm">
                {lotes.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/importacao?lote=${l.id}`} className="text-primaria hover:underline">
                      Lote {l.id} · {formatarDataHora(l.iniciadoEm)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
