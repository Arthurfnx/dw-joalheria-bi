import type { Metadata } from "next";
import { acaoCriarCadastro, acaoRenomearCadastro, acaoSituacaoCadastro } from "@/app/acoes/administracao";
import { acaoUsaTamanho } from "@/app/acoes/produtos";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, Etiqueta, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import {
  listarCadastros,
  listarOpcoesDeCadastro,
  type ItemCadastro,
  type TipoCadastro,
} from "@/servidor/servicos/cadastros";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Cadastros" };

function LinhaItem({
  tipo,
  item,
  detalhe,
}: {
  tipo: TipoCadastro;
  item: ItemCadastro & { usaTamanho?: boolean };
  detalhe?: string;
}) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{item.nome}</p>
          {detalhe ? <p className="text-xs text-texto-suave">{detalhe}</p> : null}
          {item.usaTamanho ? <p className="text-xs text-texto-suave">Usa tamanho</p> : null}
        </div>
        <Etiqueta ativo={item.ativo}>{item.ativo ? "Ativo" : "Inativo"}</Etiqueta>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-primaria">Alterar</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormularioAcao acao={acaoRenomearCadastro} rotuloBotao="Renomear" varianteBotao="secundario">
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="id" value={item.id} />
            <GrupoCampo rotulo="Nome" htmlFor={`${tipo}-${item.id}`}>
              <Campo id={`${tipo}-${item.id}`} name="nome" defaultValue={item.nome} required maxLength={80} />
            </GrupoCampo>
          </FormularioAcao>
          <FormularioAcao
            acao={acaoSituacaoCadastro}
            rotuloBotao={item.ativo ? "Desativar" : "Reativar"}
            varianteBotao={item.ativo ? "perigo" : "secundario"}
          >
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="ativo" value={item.ativo ? "false" : "true"} />
          </FormularioAcao>
          {/* RN-21A: o tamanho só existe nas categorias marcadas aqui. */}
          {tipo === "categoria" ? (
            <FormularioAcao
              acao={acaoUsaTamanho}
              rotuloBotao={item.usaTamanho ? "Deixar de usar tamanho" : "Passar a usar tamanho"}
              varianteBotao="secundario"
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="usaTamanho" value={item.usaTamanho ? "false" : "true"} />
            </FormularioAcao>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function Secao({
  titulo,
  tipo,
  itens,
  children,
}: {
  titulo: string;
  tipo: TipoCadastro;
  itens: (ItemCadastro & { detalhe?: string; usaTamanho?: boolean })[];
  children?: React.ReactNode;
}) {
  return (
    <Cartao className="min-w-0">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      <FormularioAcao acao={acaoCriarCadastro} rotuloBotao="Incluir">
        <input type="hidden" name="tipo" value={tipo} />
        {children}
        <GrupoCampo rotulo="Nome" htmlFor={`novo-${tipo}`}>
          <Campo id={`novo-${tipo}`} name="nome" required maxLength={80} />
        </GrupoCampo>
        {tipo === "categoria" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="usaTamanho" value="true" className="size-4" />
            Usa tamanho (como Anel)
          </label>
        ) : null}
      </FormularioAcao>
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-texto-suave">Nenhum item cadastrado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-borda border-t border-borda">
          {itens.map((item) => (
            <LinhaItem key={item.id} tipo={tipo} item={item} detalhe={item.detalhe} />
          ))}
        </ul>
      )}
    </Cartao>
  );
}

export default async function PaginaCadastros() {
  const ator = await exigirAcessoRota("/admin/cadastros");
  const [todos, opcoes] = await Promise.all([
    listarCadastros(bdAplicacao(), ator),
    listarOpcoesDeCadastro(bdAplicacao(), ator),
  ]);

  return (
    <>
      <TituloPagina descricao="Nomes únicos, sem diferenciar maiúsculas. Itens desativados deixam de aparecer para novos cadastros.">
        Cadastros
      </TituloPagina>
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Secao titulo="Materiais" tipo="material" itens={todos.materiais} />
        <Secao titulo="Categorias" tipo="categoria" itens={todos.categorias} />
        <Secao
          titulo="Subcategorias"
          tipo="subcategoria"
          itens={todos.subcategorias.map((s) => ({ ...s, detalhe: `Categoria: ${s.categoriaNome}` }))}
        >
          {/* RN-11: só categorias ativas podem receber subcategorias novas. */}
          <GrupoCampo rotulo="Categoria" htmlFor="nova-subcategoria-categoria">
            <Selecao id="nova-subcategoria-categoria" name="categoriaId" required defaultValue="">
              <option value="" disabled>
                Escolha a categoria
              </option>
              {opcoes.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </GrupoCampo>
        </Secao>
      </div>
    </>
  );
}
