import type { Metadata } from "next";
import { acaoRegistrarPrecoOuro } from "@/app/acoes/produtos";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, GrupoCampo, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { listarPrecosOuro, precoOuroVigente } from "@/servidor/servicos/preco-ouro";
import { formatarData, formatarDataHora, formatarReais, hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Preço do ouro" };

export default async function PaginaPrecoOuro() {
  const ator = await exigirAcessoRota("/admin/preco-ouro");
  const [historico, vigente] = await Promise.all([listarPrecosOuro(bdAplicacao(), ator), precoOuroVigente(bdAplicacao())]);

  return (
    <>
      <TituloPagina descricao="Valor em reais por grama de ouro 1000. Cada registro é definitivo: para corrigir, registre um novo.">
        Preço do ouro
      </TituloPagina>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Cartao>
            <p className="text-xs text-texto-suave">Vigente hoje</p>
            <p className="text-2xl font-semibold">{vigente ? formatarReais(vigente) : "Não registrado"}</p>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 font-semibold">Novo registro</h2>
            <FormularioAcao acao={acaoRegistrarPrecoOuro} rotuloBotao="Registrar" confirmar="Registrar este preço? O registro não pode ser alterado depois.">
              <GrupoCampo rotulo="Valor por grama (R$)" htmlFor="valorGrama">
                <Campo id="valorGrama" name="valorGrama" inputMode="decimal" required />
              </GrupoCampo>
              <GrupoCampo rotulo="Vigente a partir de" htmlFor="vigenteDesde">
                <Campo id="vigenteDesde" name="vigenteDesde" type="date" defaultValue={hojeSaoPaulo()} required />
              </GrupoCampo>
            </FormularioAcao>
          </Cartao>
        </div>
        <Cartao>
          <h2 className="mb-3 font-semibold">Histórico</h2>
          {historico.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum registro.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {historico.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
                  <span className="font-medium">{formatarReais(h.valorGrama)}</span>
                  <span className="text-texto-suave">
                    desde {formatarData(h.vigenteDesde)} · por {h.registradoPor} em {formatarDataHora(h.registradoEm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
