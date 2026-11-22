import type { Metadata } from "next";
import { acaoAlterarConfiguracao } from "@/app/acoes/administracao";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, GrupoCampo, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { listarConfiguracoes } from "@/servidor/servicos/configuracoes";
import { formatarDataHora } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  const ator = await exigirAcessoRota("/admin/configuracoes");
  const parametros = await listarConfiguracoes(bdAplicacao(), ator);

  return (
    <>
      <TituloPagina>Configurações</TituloPagina>
      <ul className="max-w-xl space-y-3">
        {parametros.map((p) => (
          <li key={p.chave}>
            <Cartao>
              <p className="font-medium">{p.descricao}</p>
              <p className="mb-3 text-xs break-all text-texto-suave">
                {p.chave} · alterado em {formatarDataHora(p.atualizadoEm)}
                {p.atualizadoPor ? ` por ${p.atualizadoPor}` : ""}
              </p>
              <FormularioAcao acao={acaoAlterarConfiguracao} rotuloBotao="Salvar" varianteBotao="secundario">
                <input type="hidden" name="chave" value={p.chave} />
                <GrupoCampo rotulo="Valor" htmlFor={`cfg-${p.chave}`}>
                  <Campo id={`cfg-${p.chave}`} name="valor" defaultValue={p.valor} required inputMode="numeric" />
                </GrupoCampo>
              </FormularioAcao>
            </Cartao>
          </li>
        ))}
      </ul>
    </>
  );
}
