import type { Metadata } from "next";
import { Cartao, TituloPagina } from "@/componentes/ui";
import { urlRelatorioPowerBi } from "@/servidor/ambiente";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Relatórios" };

export default async function PaginaRelatorios() {
  // RN-72: a permissão é conferida antes de o endereço ser lido e enviado ao navegador.
  await exigirAcessoRota("/relatorios");
  const url = urlRelatorioPowerBi();

  return (
    <>
      <TituloPagina>Relatórios</TituloPagina>
      {url ? (
        <Cartao className="p-0">
          <iframe
            src={url}
            title="Relatório do Power BI"
            className="block aspect-[4/3] w-full rounded-lg md:aspect-video"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </Cartao>
      ) : (
        <Cartao>
          <p className="font-medium">Relatório não configurado.</p>
          <p className="mt-1 text-sm text-texto-suave">
            Defina a variável POWERBI_URL_RELATORIO com o endereço do relatório publicado, que deve começar por
            https://app.powerbi.com/, e reinicie a aplicação.
          </p>
        </Cartao>
      )}
    </>
  );
}
