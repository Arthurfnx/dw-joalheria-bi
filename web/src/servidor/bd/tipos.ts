// Tipos das tabelas do esquema app para o Kysely. Espelham as migrations de
// web/db/migrations; ids bigint chegam do driver pg como texto.

import type { ColumnType, GeneratedAlways, Generated } from "kysely";

type Momento = ColumnType<Date, Date | string | undefined, Date | string>;
type MomentoOpcional = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type Json = ColumnType<unknown, string | null | undefined, string | null>;

export interface TabelaUsuario {
  id: GeneratedAlways<string>;
  nome: string;
  login: string;
  senha_hash: string;
  perfil: "ADMINISTRADOR" | "VENDEDOR";
  ativo: Generated<boolean>;
  deve_trocar_senha: Generated<boolean>;
  falhas_login: Generated<number>;
  bloqueado_ate: MomentoOpcional;
  criado_em: Generated<Date>;
  atualizado_em: Generated<Date>;
}

export interface TabelaSessao {
  token_hash: string;
  usuario_id: string;
  criada_em: Generated<Date>;
  ultimo_uso_em: Generated<Date>;
  expira_em: Momento;
  revogada_em: MomentoOpcional;
}

export interface TabelaDominio {
  id: GeneratedAlways<string>;
  nome: string;
  ativo: Generated<boolean>;
}

export interface TabelaSubcategoria extends TabelaDominio {
  categoria_id: string;
}

export interface TabelaAuditoria {
  id: GeneratedAlways<string>;
  ocorrido_em: Generated<Date>;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_antes: Json;
  dados_depois: Json;
}

export interface TabelaConfiguracao {
  chave: string;
  valor: string;
  descricao: string;
  atualizado_em: Generated<Date>;
  atualizado_por: string | null;
}

// numeric chega do driver pg como texto: valores monetários nunca passam por ponto flutuante.
type Numerico = ColumnType<string, string | number, string | number>;
type NumericoOpcional = ColumnType<string | null, string | number | null | undefined, string | number | null>;
// date chega como texto AAAA-MM-DD (ver conexao.ts): datas de negócio não têm fuso.
type Data = string;
type DataOpcional = ColumnType<string | null, string | null | undefined, string | null>;

export interface TabelaCategoria extends TabelaDominio {
  usa_tamanho: Generated<boolean>;
}

export interface TabelaProduto {
  id: GeneratedAlways<string>;
  codigo: string;
  descricao: string;
  material_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  modo_controle: "UNITARIO" | "QUANTIDADE";
  peso_gramas: NumericoOpcional;
  tamanho: string | null;
  pedras: string | null;
  preco_venda: NumericoOpcional;
  estoque_minimo: number | null;
  observacao: string | null;
  indice_preco: NumericoOpcional;
  valor_aquisicao: NumericoOpcional;
  data_aquisicao: DataOpcional;
  local_estoque: string | null;
  consignado_com: string | null;
  ativo: Generated<boolean>;
  criado_em: Generated<Date>;
  atualizado_em: Generated<Date>;
}

export interface TabelaSaldoEstoque {
  produto_id: string;
  quantidade: number;
  atualizado_em: Date;
}

export interface TabelaTipoMovimentacao {
  codigo: string;
  descricao: string;
  sinal: number;
  eh_venda: boolean;
  exige_motivo: boolean;
  origem_exigida: string;
  uso_manual: boolean;
}

export interface TabelaMovimentacao {
  id: GeneratedAlways<string>;
  produto_id: string;
  tipo_codigo: string;
  quantidade: number;
  saldo_apos: number;
  custo_unitario: NumericoOpcional;
  motivo: string | null;
  venda_item_id: string | null;
  compra_item_id: string | null;
  estorna_id: string | null;
  data_ocorrencia: Data;
  usuario_id: string;
  registrada_em: Generated<Date>;
}

export interface TabelaImportacaoLote {
  id: GeneratedAlways<string>;
  arquivo: string;
  iniciado_em: Generated<Date>;
  concluido_em: Date | null;
  usuario_id: string;
  contagens: ColumnType<Record<string, Record<string, number>>, string, string>;
}

export interface TabelaImportacaoOcorrencia {
  id: GeneratedAlways<string>;
  lote_id: string;
  aba: string;
  linha: number;
  codigo: string | null;
  tipo: "REJEITADA" | "REVISAR";
  motivo: string;
}

export interface TabelaProdutoOrigem {
  produto_id: string;
  lote_id: string;
  aba: string;
  linha: number;
  arquivo: string;
  local_original: string | null;
  tamanho_original: string | null;
  situacao_original: string;
}

export interface TabelaVendaHistorica {
  id: GeneratedAlways<string>;
  produto_id: string;
  lote_id: string;
  data_venda: Data;
  valor_venda: NumericoOpcional;
  valor_compra: NumericoOpcional;
  simbolico: boolean;
}

export interface TabelaPrecoOuro {
  id: GeneratedAlways<string>;
  valor_grama: Numerico;
  vigente_desde: Data;
  registrado_em: Generated<Date>;
  registrado_por: string;
}

export interface TabelaVenda {
  id: GeneratedAlways<string>;
  numero: Generated<string>;
  chave_idempotencia: string;
  data_venda: Data;
  situacao: Generated<"CONFIRMADA" | "CANCELADA">;
  vendedor_id: string;
  valor_total: Numerico;
  observacao: string | null;
  registrada_em: Generated<Date>;
  cancelada_em: Date | null;
  cancelada_por: string | null;
  motivo_cancelamento: string | null;
}

export interface TabelaVendaItem {
  id: GeneratedAlways<string>;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_tabela: NumericoOpcional;
  preco_praticado: Numerico;
  valor_item: GeneratedAlways<string>;
}

export interface BancoApp {
  "app.usuario": TabelaUsuario;
  "app.sessao": TabelaSessao;
  "app.material": TabelaDominio;
  "app.categoria": TabelaCategoria;
  "app.produto": TabelaProduto;
  "app.saldo_estoque": TabelaSaldoEstoque;
  "app.tipo_movimentacao": TabelaTipoMovimentacao;
  "app.movimentacao_estoque": TabelaMovimentacao;
  "app.importacao_lote": TabelaImportacaoLote;
  "app.importacao_ocorrencia": TabelaImportacaoOcorrencia;
  "app.produto_origem": TabelaProdutoOrigem;
  "app.venda_historica": TabelaVendaHistorica;
  "app.preco_ouro": TabelaPrecoOuro;
  "app.venda": TabelaVenda;
  "app.venda_item": TabelaVendaItem;
  "app.divergencia_saldo": { produto_id: string; saldo: number; soma_movimentacoes: number };
  "app.subcategoria": TabelaSubcategoria;
  "app.auditoria": TabelaAuditoria;
  "app.configuracao": TabelaConfiguracao;
}
