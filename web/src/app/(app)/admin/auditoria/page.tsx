import type { Metadata } from "next";
import { Aviso, Botao, Campo, Cartao, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroValidacao } from "@/servidor/erros";
import {
  consultarAuditoria,
  LIMITE_REGISTROS_AUDITORIA,
  opcoesFiltroAuditoria,
  type RegistroAuditoria,
} from "@/servidor/servicos/consulta-auditoria";
import { formatarDataHora } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Auditoria" };

type Parametros = Record<string, string | string[] | undefined>;

function texto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

function Dados({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  if (valor === null || valor === undefined) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-texto-suave">{rotulo}</p>
      <pre className="mt-1 rounded bg-fundo p-2 text-xs break-all whitespace-pre-wrap">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  );
}

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<Parametros> }) {
  const ator = await exigirAcessoRota("/admin/auditoria");
  const p = await searchParams;
  const filtro = { de: texto(p.de), ate: texto(p.ate), usuarioId: texto(p.usuarioId), entidade: texto(p.entidade) };

  const opcoes = await opcoesFiltroAuditoria(bdAplicacao(), ator);
  let registros: RegistroAuditoria[] = [];
  let limiteAtingido = false;
  let erroFiltro: string | null = null;
  try {
    ({ registros, limiteAtingido } = await consultarAuditoria(bdAplicacao(), ator, filtro));
  } catch (erro) {
    if (!(erro instanceof ErroValidacao)) throw erro;
    erroFiltro = erro.message;
  }

  return (
    <>
      <TituloPagina descricao="Registros imutáveis das operações, do mais recente para o mais antigo.">Auditoria</TituloPagina>

      <Cartao className="mb-4">
        {/* Filtro por GET: a consulta não altera dados e o endereço pode ser guardado. */}
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <GrupoCampo rotulo="De" htmlFor="f-de">
            <Campo id="f-de" name="de" type="date" defaultValue={filtro.de} />
          </GrupoCampo>
          <GrupoCampo rotulo="Até" htmlFor="f-ate">
            <Campo id="f-ate" name="ate" type="date" defaultValue={filtro.ate} />
          </GrupoCampo>
          <GrupoCampo rotulo="Usuário" htmlFor="f-usuario">
            <Selecao id="f-usuario" name="usuarioId" defaultValue={filtro.usuarioId}>
              <option value="">Todos</option>
              {opcoes.usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Selecao>
          </GrupoCampo>
          <GrupoCampo rotulo="Entidade" htmlFor="f-entidade">
            <Selecao id="f-entidade" name="entidade" defaultValue={filtro.entidade}>
              <option value="">Todas</option>
              {opcoes.entidades.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Selecao>
          </GrupoCampo>
          <Botao type="submit" variante="secundario">
            Filtrar
          </Botao>
        </form>
      </Cartao>

      {erroFiltro ? <Aviso tipo="erro" className="mb-4">{erroFiltro}</Aviso> : null}
      {limiteAtingido ? (
        <Aviso tipo="alerta" className="mb-4">
          Mostrando os {LIMITE_REGISTROS_AUDITORIA} registros mais recentes. Use os filtros para refinar.
        </Aviso>
      ) : null}

      {registros.length === 0 && !erroFiltro ? (
        <p className="text-sm text-texto-suave">Nenhum registro encontrado.</p>
      ) : (
        <ul className="space-y-3">
          {registros.map((r) => (
            <li key={r.id}>
              <Cartao>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-medium">
                    {r.acao} · {r.entidade}
                    {r.entidadeId ? ` #${r.entidadeId}` : ""}
                  </p>
                  <p className="text-xs text-texto-suave">{formatarDataHora(r.ocorridoEm)}</p>
                </div>
                <p className="text-sm text-texto-suave">Por: {r.usuarioNome ?? "—"}</p>
                {r.dadosAntes !== null || r.dadosDepois !== null ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-primaria">Antes e depois</summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Dados rotulo="Antes" valor={r.dadosAntes} />
                      <Dados rotulo="Depois" valor={r.dadosDepois} />
                    </div>
                  </details>
                ) : null}
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
