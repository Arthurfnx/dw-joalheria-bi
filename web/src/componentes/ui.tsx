// Componentes básicos no estilo shadcn/ui, escritos no próprio projeto e só
// com Tailwind: nenhuma biblioteca de componentes é instalada.

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type VarianteBotao = "primario" | "secundario" | "perigo" | "discreto";

const CLASSES_BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-primaria text-primaria-texto hover:bg-primaria-escura",
  secundario: "border border-borda bg-superficie text-texto hover:bg-fundo",
  perigo: "border border-perigo/40 bg-superficie text-perigo hover:bg-perigo-fundo",
  discreto: "text-texto-suave hover:bg-fundo hover:text-texto",
};

export function Botao({
  variante = "primario",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria",
        "disabled:pointer-events-none disabled:opacity-50",
        CLASSES_BOTAO[variante],
        className,
      )}
      {...props}
    />
  );
}

const CLASSES_CAMPO =
  "block w-full min-w-0 rounded-md border border-borda bg-superficie px-3 py-2 text-base sm:text-sm " +
  "focus:border-primaria focus:outline-2 focus:outline-primaria/30";

export function Campo({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CLASSES_CAMPO, "min-h-10", className)} {...props} />;
}

export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CLASSES_CAMPO, "min-h-10", className)} {...props} />;
}

export function Rotulo({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium", className)} {...props} />;
}

export function GrupoCampo({ rotulo, htmlFor, children }: { rotulo: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Rotulo htmlFor={htmlFor}>{rotulo}</Rotulo>
      {children}
    </div>
  );
}

export function Cartao({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-borda bg-superficie p-4 shadow-sm", className)} {...props} />;
}

export function TituloPagina({ children, descricao }: { children: ReactNode; descricao?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {descricao ? <p className="mt-1 text-sm text-texto-suave">{descricao}</p> : null}
    </div>
  );
}

type TipoAviso = "info" | "erro" | "sucesso" | "alerta";

const CLASSES_AVISO: Record<TipoAviso, string> = {
  info: "border-borda bg-superficie text-texto",
  erro: "border-perigo/30 bg-perigo-fundo text-perigo",
  sucesso: "border-sucesso/30 bg-sucesso-fundo text-sucesso",
  alerta: "border-aviso/30 bg-aviso-fundo text-aviso",
};

export function Aviso({ tipo = "info", className, ...props }: HTMLAttributes<HTMLDivElement> & { tipo?: TipoAviso }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm", CLASSES_AVISO[tipo], className)}
      {...props}
    />
  );
}

export function Etiqueta({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        ativo ? "bg-sucesso-fundo text-sucesso" : "bg-fundo text-texto-suave",
      )}
    >
      {children}
    </span>
  );
}
