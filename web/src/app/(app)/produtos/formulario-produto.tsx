"use client";

// Formulário de cadastro e edição de produto (RN-21). O tamanho só aparece
// quando a categoria usa tamanho (RN-21A); o nome de quem está com a peça só
// quando o local é Consignado. O servidor e o banco repetem as duas regras.

import { useState } from "react";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, GrupoCampo, Selecao } from "@/componentes/ui";
import type { EstadoAcao } from "@/web/estado-acao";

interface Opcao {
  id: string;
  nome: string;
}

export interface ValoresProduto {
  id?: string;
  codigo: string;
  descricao: string;
  materialId: string;
  categoriaId: string;
  subcategoriaId: string;
  modoControle: string;
  pesoGramas: string;
  tamanho: string;
  pedras: string;
  precoVenda: string;
  estoqueMinimo: string;
  observacao: string;
  indicePreco: string;
  valorAquisicao: string;
  dataAquisicao: string;
  localEstoque: string;
  consignadoCom: string;
}

export const PRODUTO_VAZIO: ValoresProduto = {
  codigo: "", descricao: "", materialId: "", categoriaId: "", subcategoriaId: "", modoControle: "UNITARIO",
  pesoGramas: "", tamanho: "", pedras: "", precoVenda: "", estoqueMinimo: "", observacao: "", indicePreco: "",
  valorAquisicao: "", dataAquisicao: "", localEstoque: "Estoque", consignadoCom: "",
};

const LOCAIS = ["Estoque", "Armário", "Maleta 1", "Maleta 2", "Consignado"];

export function FormularioProduto({
  acao,
  valores,
  materiais,
  categorias,
  subcategorias,
  novo,
  codigoTravado,
  hoje,
}: {
  acao: (anterior: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
  valores: ValoresProduto;
  materiais: Opcao[];
  categorias: (Opcao & { usaTamanho: boolean })[];
  subcategorias: (Opcao & { categoriaId: string })[];
  novo: boolean;
  /** RN-20 e RN-22: com movimentação, código e modo não mudam. */
  codigoTravado: boolean;
  hoje: string;
}) {
  const [categoriaId, setCategoriaId] = useState(valores.categoriaId);
  const [local, setLocal] = useState(valores.localEstoque);
  const usaTamanho = categorias.find((c) => c.id === categoriaId)?.usaTamanho ?? false;
  const subsDaCategoria = subcategorias.filter((s) => s.categoriaId === categoriaId);

  return (
    <FormularioAcao acao={acao} rotuloBotao={novo ? "Cadastrar produto" : "Salvar alterações"}>
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <GrupoCampo rotulo="Código" htmlFor="codigo">
          {codigoTravado ? <input type="hidden" name="codigo" value={valores.codigo} /> : null}
          <Campo id="codigo" name={codigoTravado ? undefined : "codigo"} defaultValue={valores.codigo} required maxLength={40} disabled={codigoTravado} autoCapitalize="characters" />
        </GrupoCampo>
        <GrupoCampo rotulo="Modo de controle" htmlFor="modoControle">
          {codigoTravado ? <input type="hidden" name="modoControle" value={valores.modoControle} /> : null}
          <Selecao id="modoControle" name={codigoTravado ? undefined : "modoControle"} defaultValue={valores.modoControle} disabled={codigoTravado}>
            <option value="UNITARIO">Peça única</option>
            <option value="QUANTIDADE">Quantidade</option>
          </Selecao>
        </GrupoCampo>
        <div className="sm:col-span-2">
          <GrupoCampo rotulo="Descrição" htmlFor="descricao">
            <Campo id="descricao" name="descricao" defaultValue={valores.descricao} required maxLength={300} />
          </GrupoCampo>
        </div>
        <GrupoCampo rotulo="Material" htmlFor="materialId">
          <Selecao id="materialId" name="materialId" defaultValue={valores.materialId} required>
            <option value="" disabled>Escolha</option>
            {materiais.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </GrupoCampo>
        <GrupoCampo rotulo="Categoria" htmlFor="categoriaId">
          <Selecao id="categoriaId" name="categoriaId" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
            <option value="" disabled>Escolha</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
        </GrupoCampo>
        {subsDaCategoria.length > 0 ? (
          <GrupoCampo rotulo="Subcategoria (opcional)" htmlFor="subcategoriaId">
            <Selecao id="subcategoriaId" name="subcategoriaId" defaultValue={valores.subcategoriaId}>
              <option value="">Nenhuma</option>
              {subsDaCategoria.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
          </GrupoCampo>
        ) : null}
        {usaTamanho ? (
          <GrupoCampo rotulo="Tamanho" htmlFor="tamanho">
            <Campo id="tamanho" name="tamanho" defaultValue={valores.tamanho} maxLength={20} />
          </GrupoCampo>
        ) : null}
        <GrupoCampo rotulo="Peso (g)" htmlFor="pesoGramas">
          <Campo id="pesoGramas" name="pesoGramas" defaultValue={valores.pesoGramas} inputMode="decimal" />
        </GrupoCampo>
        <GrupoCampo rotulo="Índice de preço" htmlFor="indicePreco">
          <Campo id="indicePreco" name="indicePreco" defaultValue={valores.indicePreco} inputMode="decimal" />
        </GrupoCampo>
        <GrupoCampo rotulo="Preço de venda (R$)" htmlFor="precoVenda">
          <Campo id="precoVenda" name="precoVenda" defaultValue={valores.precoVenda} inputMode="decimal" />
        </GrupoCampo>
        <GrupoCampo rotulo="Valor de aquisição (R$)" htmlFor="valorAquisicao">
          <Campo id="valorAquisicao" name="valorAquisicao" defaultValue={valores.valorAquisicao} inputMode="decimal" />
        </GrupoCampo>
        <GrupoCampo rotulo="Data de aquisição" htmlFor="dataAquisicao">
          <Campo id="dataAquisicao" name="dataAquisicao" type="date" max={hoje} defaultValue={valores.dataAquisicao} />
        </GrupoCampo>
        <GrupoCampo rotulo="Estoque mínimo" htmlFor="estoqueMinimo">
          <Campo id="estoqueMinimo" name="estoqueMinimo" defaultValue={valores.estoqueMinimo} inputMode="numeric" />
        </GrupoCampo>
        <GrupoCampo rotulo="Local" htmlFor="localEstoque">
          <Selecao id="localEstoque" name="localEstoque" value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Sem local</option>
            {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Selecao>
        </GrupoCampo>
        {local === "Consignado" ? (
          <GrupoCampo rotulo="Consignado com" htmlFor="consignadoCom">
            <Campo id="consignadoCom" name="consignadoCom" defaultValue={valores.consignadoCom} required maxLength={120} />
          </GrupoCampo>
        ) : null}
        <div className="sm:col-span-2">
          <GrupoCampo rotulo="Pedras" htmlFor="pedras">
            <Campo id="pedras" name="pedras" defaultValue={valores.pedras} maxLength={300} />
          </GrupoCampo>
        </div>
        <div className="sm:col-span-2">
          <GrupoCampo rotulo="Observação" htmlFor="observacao">
            <Campo id="observacao" name="observacao" defaultValue={valores.observacao} maxLength={1000} />
          </GrupoCampo>
        </div>
        {novo ? (
          <GrupoCampo rotulo="Saldo inicial (opcional)" htmlFor="saldoInicial">
            <Campo id="saldoInicial" name="saldoInicial" inputMode="numeric" placeholder="0" />
          </GrupoCampo>
        ) : null}
      </div>
      {novo ? (
        <p className="text-xs text-texto-suave">
          Com saldo inicial, a entrada usa o valor de aquisição como custo e a data de aquisição como data (sem data, hoje).
        </p>
      ) : null}
    </FormularioAcao>
  );
}
