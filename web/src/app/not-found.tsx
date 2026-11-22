import Link from "next/link";

export default function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="mt-2 text-texto-suave">O endereço não existe ou foi digitado errado.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-primaria hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
