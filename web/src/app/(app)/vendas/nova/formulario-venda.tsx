"use client";

// Nova venda (seção 5): digitar código ou descrição → tocar no produto (entra
// com quantidade 1 e o preço de tabela) → ajustar o preço, se preciso →
// Confirmar. O total mostrado aqui é só uma prévia: o valor gravado é
// calculado pelo banco (I8).

import { useActionState, useEffect, useRef, useState } from "react";
import { acaoBuscarProdutosVenda, acaoConfirmarVenda } from "@/app/acoes/vendas";
import { Aviso, Botao, Campo, Cartao, GrupoCampo } from "@/componentes/ui";
import { ESTADO_INICIAL } from "@/web/estado-acao";
import type { ProdutoParaVenda } from "@/servidor/servicos/vendas";

interface Item {
  produtoId: string;
  codigo: string;
  descricao: string;
  saldo: number;
  modoControle: string;
  precoTabela: string | null;
  quantidade: string;
  precoPraticado: string;
}

const ZERO = BigInt(0);
const CEM = BigInt(100);

/** "1.234,56" ou "1234.56" em centavos inteiros; null se inválido. Sem ponto flutuante. */
function centavos(texto: string): bigint | null {
  const v = texto.trim().replace(/^R\$\s*/i, "");
  const normal = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(normal);
  if (!m) return null;
  return BigInt(m[1]) * CEM + BigInt((m[2] ?? "").padEnd(2, "0"));
}

function reais(c: bigint): string {
  const inteiro = (c / CEM).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiro},${(c % CEM).toString().padStart(2, "0")}`;
}

/** Preço do banco ("1234.50") no formato de digitação ("1234,50"). */
function paraDigitar(preco: string | null): string {
  return preco ? preco.replace(".", ",") : "";
}

export function FormularioVenda({ chave, hoje }: { chave: string; hoje: string }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoParaVenda[]>([]);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [estado, acao, pendente] = useActionState(acaoConfirmarVenda, ESTADO_INICIAL);
  const buscaAtual = useRef(0);

  // Busca com espera curta, descartando respostas de buscas já superadas.
  useEffect(() => {
    const t = termo.trim();
    const numero = ++buscaAtual.current;
    if (t === "") return;
    const espera = setTimeout(async () => {
      const r = await acaoBuscarProdutosVenda(t);
      if (numero !== buscaAtual.current) return;
      setResultados(r.produtos);
      setErroBusca(r.erro ?? null);
    }, 250);
    return () => clearTimeout(espera);
  }, [termo]);

  function adicionar(p: ProdutoParaVenda) {
    setItens((atuais) => {
      const existente = atuais.find((i) => i.produtoId === p.id);
      if (existente) {
        // RN-40: o produto não se repete; tocar de novo soma uma unidade, até o saldo.
        return atuais.map((i) =>
          i.produtoId === p.id && Number(i.quantidade) < p.saldo ? { ...i, quantidade: String(Number(i.quantidade) + 1) } : i,
        );
      }
      return [
        ...atuais,
        {
          produtoId: p.id,
          codigo: p.codigo,
          descricao: p.descricao,
          saldo: p.saldo,
          modoControle: p.modoControle,
          precoTabela: p.precoTabela,
          quantidade: "1",
          precoPraticado: paraDigitar(p.precoTabela),
        },
      ];
    });
    setTermo("");
    setResultados([]);
  }

  const alterar = (id: string, campo: "quantidade" | "precoPraticado", valor: string) =>
    setItens((atuais) => atuais.map((i) => (i.produtoId === id ? { ...i, [campo]: valor } : i)));

  const totalPrevia = itens.reduce<bigint | null>((soma, i) => {
    const preco = centavos(i.precoPraticado);
    const qtd = /^\d+$/.test(i.quantidade) ? BigInt(i.quantidade) : null;
    return soma === null || preco === null || qtd === null ? null : soma + preco * qtd;
  }, ZERO);

  const itensParaEnvio = JSON.stringify(
    itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoPraticado: i.precoPraticado })),
  );

  return (
    <div className="space-y-4">
      <Cartao>
        <GrupoCampo rotulo="Produto (código ou descrição)" htmlFor="busca">
          <Campo
            id="busca"
            type="search"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              if (e.target.value.trim() === "") setResultados([]);
            }}
            autoComplete="off"
            autoFocus
            placeholder="Digite para buscar"
          />
        </GrupoCampo>
        {erroBusca ? <Aviso tipo="erro" className="mt-2">{erroBusca}</Aviso> : null}
        {termo.trim() !== "" && resultados.length > 0 ? (
          <ul className="mt-2 divide-y divide-borda rounded-md border border-borda">
            {resultados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => adicionar(p)} className="block w-full px-3 py-2 text-left hover:bg-fundo">
                  <span className="block text-sm break-words">
                    <span className="mr-2 font-mono">{p.codigo}</span>
                    {p.descricao}
                  </span>
                  <span className="text-xs text-texto-suave">
                    Saldo {p.saldo} · {p.precoTabela ? reais(centavos(p.precoTabela) ?? ZERO) : "sem preço de tabela"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Cartao>

      <form action={acao} className="space-y-4">
        <input type="hidden" name="chave" value={chave} />
        <input type="hidden" name="itens" value={itensParaEnvio} />

        <Cartao>
          <h2 className="mb-2 font-semibold">Itens</h2>
          {itens.length === 0 ? (
            <p className="text-sm text-texto-suave">Busque um produto e toque nele para incluir.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {itens.map((i) => (
                <li key={i.produtoId} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm break-words">
                      <span className="mr-2 font-mono">{i.codigo}</span>
                      {i.descricao}
                    </p>
                    <button
                      type="button"
                      onClick={() => setItens((a) => a.filter((x) => x.produtoId !== i.produtoId))}
                      className="shrink-0 text-sm text-perigo hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <GrupoCampo rotulo="Quantidade" htmlFor={`q-${i.produtoId}`}>
                      <Campo
                        id={`q-${i.produtoId}`}
                        value={i.quantidade}
                        onChange={(e) => alterar(i.produtoId, "quantidade", e.target.value)}
                        inputMode="numeric"
                        readOnly={i.modoControle === "UNITARIO"}
                      />
                    </GrupoCampo>
                    <GrupoCampo rotulo="Preço (R$)" htmlFor={`p-${i.produtoId}`}>
                      <Campo
                        id={`p-${i.produtoId}`}
                        value={i.precoPraticado}
                        onChange={(e) => alterar(i.produtoId, "precoPraticado", e.target.value)}
                        inputMode="decimal"
                        required
                        placeholder="Informe"
                      />
                    </GrupoCampo>
                  </div>
                  <p className="mt-1 text-xs text-texto-suave">
                    Preço de tabela: {i.precoTabela ? reais(centavos(i.precoTabela) ?? ZERO) : "não há"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-borda pt-3 text-right text-lg font-semibold">
            Total: {totalPrevia === null ? "—" : reais(totalPrevia)}
          </p>
        </Cartao>

        <Cartao className="space-y-3">
          <GrupoCampo rotulo="Data da venda" htmlFor="dataVenda">
            <Campo id="dataVenda" name="dataVenda" type="date" defaultValue={hoje} max={hoje} required />
          </GrupoCampo>
          <GrupoCampo rotulo="Observação (opcional)" htmlFor="observacao">
            <Campo id="observacao" name="observacao" maxLength={500} />
          </GrupoCampo>
          <Botao type="submit" disabled={pendente || itens.length === 0} className="w-full">
            {pendente ? "Confirmando..." : "Confirmar venda"}
          </Botao>
          {estado.tipo === "erro" ? <Aviso tipo="erro" key={estado.carimbo}>{estado.mensagem}</Aviso> : null}
        </Cartao>
      </form>
    </div>
  );
}
