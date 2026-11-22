import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterAtor } from "@/web/sessao";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  // Quem já tem sessão válida não precisa ver o login de novo.
  if (await obterAtor()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">Nobreza Jóias</h1>
        <p className="mb-6 text-center text-sm text-texto-suave">Entre com o seu login e senha.</p>
        <FormularioLogin />
      </div>
    </main>
  );
}
