"use client";

// Erro inesperado: mensagem genérica, sem detalhes técnicos na tela.

import Link from "next/link";

export default function PaginaErro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="mt-2 text-texto-suave">Não foi possível carregar esta tela. Tente de novo em instantes.</p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={reset} className="text-primaria hover:underline">
          Tentar de novo
        </button>
        <Link href="/" className="text-primaria hover:underline">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
