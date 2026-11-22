// Estado devolvido pelas ações de servidor às telas. Sem dependência de servidor:
// é importado também por componentes de cliente.

export interface EstadoAcao {
  tipo: "inicial" | "ok" | "erro";
  mensagem: string;
  /** Muda a cada resposta, para a tela saber que chegou um resultado novo. */
  carimbo: number;
}

export const ESTADO_INICIAL: EstadoAcao = { tipo: "inicial", mensagem: "", carimbo: 0 };

export function estadoOk(mensagem: string): EstadoAcao {
  return { tipo: "ok", mensagem, carimbo: Date.now() };
}

export function estadoErro(mensagem: string): EstadoAcao {
  return { tipo: "erro", mensagem, carimbo: Date.now() };
}
