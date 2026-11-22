import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { TituloPagina } from "@/componentes/ui";
import { hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";
import { FormularioVenda } from "./formulario-venda";

export const metadata: Metadata = { title: "Nova venda" };

export default async function PaginaNovaVenda() {
  await exigirAcessoRota("/vendas/nova");
  // RN-43: a chave nasce ao abrir a tela; reenviar o mesmo formulário devolve a mesma venda.
  return (
    <div className="max-w-2xl">
      <TituloPagina>Nova venda</TituloPagina>
      <FormularioVenda chave={randomUUID()} hoje={hojeSaoPaulo()} />
    </div>
  );
}
