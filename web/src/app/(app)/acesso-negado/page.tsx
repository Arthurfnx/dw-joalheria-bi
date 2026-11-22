import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TituloPagina } from "@/componentes/ui";

export const metadata: Metadata = { title: "Acesso negado" };

export default function PaginaAcessoNegado() {
  return (
    <div className="max-w-lg">
      <TituloPagina>Acesso negado</TituloPagina>
      <Cartao>
        <p>O seu perfil não tem permissão para abrir esta tela.</p>
        <p className="mt-1 text-sm text-texto-suave">Se precisar do acesso, fale com o administrador.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primaria hover:underline">
          Voltar ao início
        </Link>
      </Cartao>
    </div>
  );
}
