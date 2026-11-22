"use client";

// Formulário ligado a uma ação de servidor, com a mensagem de resultado
// logo abaixo. A regra continua no servidor; a tela só envia e mostra.

import { useActionState, type ReactNode } from "react";
import { ESTADO_INICIAL, type EstadoAcao } from "@/web/estado-acao";
import { Aviso, Botao, cn } from "./ui";

export function FormularioAcao({
  acao,
  children,
  rotuloBotao,
  varianteBotao = "primario",
  confirmar,
  className,
}: {
  acao: (anterior: EstadoAcao, formulario: FormData) => Promise<EstadoAcao>;
  children?: ReactNode;
  rotuloBotao: string;
  varianteBotao?: "primario" | "secundario" | "perigo";
  /** Texto de confirmação pedido antes de enviar (operações que tiram acesso). */
  confirmar?: string;
  className?: string;
}) {
  const [estado, acaoFormulario, pendente] = useActionState(acao, ESTADO_INICIAL);
  // O React 19 limpa os campos não controlados depois de cada envio pelo atributo action.

  return (
    <form
      action={acaoFormulario}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
      className={cn("space-y-3", className)}
    >
      {children}
      <Botao type="submit" variante={varianteBotao} disabled={pendente} className="w-full sm:w-auto">
        {pendente ? "Enviando..." : rotuloBotao}
      </Botao>
      {estado.tipo !== "inicial" ? (
        <Aviso key={estado.carimbo} tipo={estado.tipo === "ok" ? "sucesso" : "erro"}>
          {estado.mensagem}
        </Aviso>
      ) : null}
    </form>
  );
}
