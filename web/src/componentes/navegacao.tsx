"use client";

// Navegação: barra lateral no desktop e menu recolhido no celular. Os itens
// chegam já filtrados pelo perfil, no servidor.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { acaoSair } from "@/app/acoes/acesso";
import { cn } from "./ui";

export interface ItemNavegacao {
  rota: string;
  rotulo: string;
}

function ehAtivo(atual: string, rota: string): boolean {
  return rota === "/" ? atual === "/" : atual === rota || atual.startsWith(rota + "/");
}

function ListaItens({ itens, aoEscolher }: { itens: ItemNavegacao[]; aoEscolher?: () => void }) {
  const caminho = usePathname();
  // Só o item de rota mais específica fica destacado ("/vendas/nova" e não também "/vendas").
  const ativa = itens
    .filter((i) => ehAtivo(caminho, i.rota))
    .reduce<string | null>((melhor, i) => (melhor === null || i.rota.length > melhor.length ? i.rota : melhor), null);
  return (
    <ul className="space-y-1">
      {itens.map((item) => (
        <li key={item.rota}>
          <Link
            href={item.rota}
            onClick={aoEscolher}
            aria-current={item.rota === ativa ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm",
              item.rota === ativa
                ? "bg-primaria text-primaria-texto"
                : "text-texto hover:bg-fundo",
            )}
          >
            {item.rotulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Rodape({ nome, perfil }: { nome: string; perfil: string }) {
  return (
    <div className="border-t border-borda pt-3">
      <p className="truncate text-sm font-medium">{nome}</p>
      <p className="text-xs text-texto-suave">{perfil === "ADMINISTRADOR" ? "Administrador" : "Vendedor"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href="/trocar-senha" className="text-sm text-primaria underline-offset-2 hover:underline">
          Trocar senha
        </Link>
        <form action={acaoSair}>
          <button type="submit" className="text-sm text-perigo underline-offset-2 hover:underline">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

export function Navegacao({ itens, nome, perfil }: { itens: ItemNavegacao[]; nome: string; perfil: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {/* Celular */}
      <header className="sticky top-0 z-30 border-b border-borda bg-superficie md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Nobreza Jóias</span>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-celular"
            className="rounded-md border border-borda px-3 py-1.5 text-sm"
          >
            {aberto ? "Fechar" : "Menu"}
          </button>
        </div>
        {aberto ? (
          <nav id="menu-celular" aria-label="Navegação principal" className="space-y-3 px-4 pb-4">
            <ListaItens itens={itens} aoEscolher={() => setAberto(false)} />
            <Rodape nome={nome} perfil={perfil} />
          </nav>
        ) : null}
      </header>

      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-borda bg-superficie md:flex md:flex-col">
        <div className="sticky top-0 flex h-screen flex-col gap-4 p-4">
          <span className="px-3 text-lg font-semibold">Nobreza Jóias</span>
          <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto">
            <ListaItens itens={itens} />
          </nav>
          <Rodape nome={nome} perfil={perfil} />
        </div>
      </aside>
    </>
  );
}
