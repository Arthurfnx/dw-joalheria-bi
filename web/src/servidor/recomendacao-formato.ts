// RN-111: regra única que escolhe o formato recomendado de um indicador pelo
// tipo do dado e pela quantidade de itens. Função pura, sem banco nem React,
// para ser usada pela tela e testada isoladamente.

export type TipoDado = "SERIE_TEMPORAL" | "COMPARACAO" | "COMPOSICAO";

export type Formato = "LINHA" | "BARRAS" | "ROSCA" | "CARTOES" | "TABELA";

export interface Recomendacao {
  formato: Formato;
  motivo: string;
}

/** Acima deste número de partes a rosca fica difícil de ler (RN-110). */
export const LIMITE_PARTES_ROSCA = 5;

export function recomendarFormato(tipo: TipoDado, quantidadeItens: number): Recomendacao {
  if (tipo === "SERIE_TEMPORAL") {
    return { formato: "LINHA", motivo: "Série no tempo: a linha mostra a tendência de um mês para o outro." };
  }
  // Sem dados não há forma a comparar: a tabela mostra os valores exatos (e o aviso de vazio).
  if (quantidadeItens <= 0) {
    return { formato: "TABELA", motivo: "Valores exatos: a tabela mostra cada número como ele é." };
  }
  if (quantidadeItens > LIMITE_PARTES_ROSCA) {
    return {
      formato: "BARRAS",
      motivo: `Comparação entre ${quantidadeItens} itens: barras ordenadas facilitam comparar os tamanhos.`,
    };
  }
  return {
    formato: "ROSCA",
    motivo:
      tipo === "COMPOSICAO"
        ? `Composição de ${quantidadeItens === 1 ? "uma parte" : `${quantidadeItens} partes`}: a rosca mostra a participação de cada parte no todo.`
        : `Poucos itens (${quantidadeItens}): a rosca mostra a participação de cada um no todo.`,
  };
}
