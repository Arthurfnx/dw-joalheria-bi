import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nobreza Jóias", template: "%s · Nobreza Jóias" },
  description: "Estoque, vendas e compras da Nobreza Jóias",
  robots: { index: false, follow: false },
};

// Todas as telas dependem da sessão: nada é pré-renderizado no build.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
