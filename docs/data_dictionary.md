# Dicionário de dados — ambiente demonstrativo (`dw_demo`)

**Status:** implementado em `db/migrations/005`–`007` (2026-10-31); **ainda não aplicado** ao banco. Qualquer divergência deve ser corrigida aqui junto com o SQL.

**Convenções:**
- Todas as tabelas de `dw_demo` têm `origem_dado VARCHAR(20) NOT NULL CHECK (origem_dado = 'SINTETICO_DEMO')`.
- Os fatos têm `id_execucao BIGINT NOT NULL`, com FK para `audit_demo.execucao`.
- Quantidades em **peças** (INTEGER). Valores monetários em R$, NUMERIC(14,2). Custo unitário em NUMERIC(14,4).
- Peso (gramas) é atributo de produto e **nunca** é somado a quantidades em peças.

---

## Dimensões

### dw_demo.dim_produto
Tipo: dimensão, SCD tipo 1. Grão: um produto do catálogo sintético.

| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| produto_key | BIGINT identity | PK | Chave substituta |
| codigo_produto | VARCHAR(30) | NOT NULL, UNIQUE, padrão `DEMO-(OURO\|PRATA\|FOLHADO)-NNNN` | Código natural sintético |
| descricao | VARCHAR(200) | NOT NULL | Descrição genérica gerada |
| material | VARCHAR(20) | NOT NULL, domínio {Ouro, Prata, Folheado} | Família comercial (material) |
| tipo_peca | VARCHAR(30) | NOT NULL, domínio configurável | Tipo de peça (Anel, Aliança, Brinco, Pingente, Colar, Cordão, Corrente, Pulseira, Tornozeleira, Conjunto…) |
| tamanho | VARCHAR(10) | NOT NULL se tipo_peca = 'Anel'; em Ouro, somente quando Anel | Tamanho/Ômega; obrigatório **somente para Anel** nesta demo |
| peso_g | NUMERIC(8,3) | > 0 e NOT NULL se Ouro; NULL se Folheado; NULL na Prata gerada | Peso em gramas |
| indice_precificacao | NUMERIC(10,4) | NOT NULL, > 0 | Índice de precificação atual do produto |
| origem_dado | VARCHAR(20) | = 'SINTETICO_DEMO' | Marcação de dado sintético |

**Não existe restrição de tipo de peça por material.** O perfil de movimentação **não** é coluna desta dimensão; fica em `staging_demo.produto_perfil_simulacao`, apenas para auditoria da simulação.

### dw_demo.dim_data
Tipo: dimensão de calendário (datas reais do calendário; não é dado sintético). Grão: um dia.

| Coluna | Tipo | Definição |
|---|---|---|
| data_key | INTEGER PK | AAAAMMDD |
| data | DATE UNIQUE NOT NULL | Data |
| dia, mes, trimestre, ano | SMALLINT | Partes da data |
| nome_mes | VARCHAR(12) | Janeiro…Dezembro |
| ano_mes | CHAR(7) | AAAA-MM |
| dia_semana | SMALLINT | 1 = segunda … 7 = domingo (ISO) |
| nome_dia_semana | VARCHAR(15) | Nome do dia |
| fim_de_semana | BOOLEAN | Sábado ou domingo |
| data_comercial | VARCHAR(30) NULL | Dia das Mães (2º domingo de maio), Dia dos Namorados (12/06), Black Friday (sexta-feira seguinte à quarta quinta-feira de novembro), Natal (25/12) |
| janela_comercial | VARCHAR(30) NULL | Data comercial cuja janela anterior (nº de dias configurável) contém o dia |
| origem_dado | VARCHAR(20) | 'SINTETICO_DEMO' (marcação do ambiente; o calendário em si é real) |

### dw_demo.dim_tipo_movimentacao
Tipo: dimensão de domínio fixo. Controla o **sinal** das movimentações.

| Coluna | Tipo | Restrição |
|---|---|---|
| tipo_mov_key | SMALLINT | PK |
| codigo_tipo | VARCHAR(30) | UNIQUE NOT NULL |
| descricao_tipo | VARCHAR(100) | NOT NULL |
| natureza | VARCHAR(20) | {implantação, entrada, saída, ajuste} |
| sinal | SMALLINT | CHECK (sinal IN (−1, 1)) |
| eh_venda | BOOLEAN | NOT NULL |
| gera_faturamento | BOOLEAN | NOT NULL |

| codigo_tipo | natureza | sinal | eh_venda | gera_faturamento |
|---|---|---|---|---|
| SALDO_INICIAL | implantação | +1 | false | false |
| ENTRADA_COMPRA | entrada | +1 | false | false |
| SAIDA_VENDA | saída | −1 | true | true (o faturamento vem de `fato_venda_item`) |
| SAIDA_PRESENTE | saída | −1 | false | false |
| SAIDA_ROUBO | saída | −1 | false | false |
| AJUSTE_POSITIVO | ajuste | +1 | false | false |
| AJUSTE_NEGATIVO | ajuste | −1 | false | false |

---

## Tabela auxiliar

### dw_demo.parametro_preco_ouro (versionada)
| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| parametro_id | BIGINT identity | PK | Identifica uma versão |
| data_referencia | DATE | NOT NULL | Data de referência do preço |
| versao | SMALLINT | NOT NULL, ≥ 1; UNIQUE (data_referencia, versao) | Versão do preço da data |
| preco_ouro_1000 | NUMERIC(12,2) | NOT NULL, > 0 | Valor informado |
| unidade_referencia | VARCHAR(40) | NOT NULL | Demo: `NAO_CONFIRMADA_DEMO`. A unidade real ainda precisa ser explicitada e validada |
| vigente | BOOLEAN | NOT NULL; índice único parcial em (data_referencia) WHERE vigente | No máximo uma versão vigente por data |
| substitui_parametro_id | BIGINT NULL | FK para a própria tabela | Versão corrigida por esta |
| motivo_correcao | TEXT NULL | NOT NULL quando versao > 1 | Justificativa da correção |
| criado_em | TIMESTAMPTZ | NOT NULL DEFAULT now() | Preenchido pelo banco |
| origem_dado | VARCHAR(20) | 'SINTETICO_DEMO' | |

- **Correção:** feita somente pela procedure `dw_demo.corrigir_preco_ouro(data, valor, motivo)`, que cria a versão N+1 vigente, desativa a anterior e registra a operação em `audit_demo`.
- **Trigger:**
  - bloqueia DELETE;
  - bloqueia UPDATE de `preco_ouro_1000`, `data_referencia`, `versao` e `criado_em`;
  - bloqueia a reativação de uma versão (`vigente` de false para true).

---

## Fatos

### dw_demo.fato_compra_item
**Grão:** um produto em uma entrada de mercadoria sintética. **Tipo:** transacional.

| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| compra_item_key | BIGINT identity | PK | Chave técnica |
| id_entrada_sintetica | VARCHAR(20) | NOT NULL | Dimensão degenerada (`DEMO-ENT-NNNNNN`) |
| numero_item | SMALLINT | NOT NULL; UNIQUE (id_entrada_sintetica, numero_item) | Item dentro da entrada |
| id_evento_origem | VARCHAR(30) | UNIQUE NOT NULL | `DEMO-ENT-NNNNNN-III` (item com 3 dígitos); liga o item à movimentação ENTRADA_COMPRA |
| data_key | INTEGER | FK dim_data | Data da entrada |
| data_hora_entrada | TIMESTAMP | NOT NULL | Data e hora da entrada |
| produto_key | BIGINT | FK dim_produto | Produto recebido |
| parametro_preco_ouro_id | BIGINT NULL | FK parametro_preco_ouro; obrigatório para Ouro/Prata (validação no ETL e em teste) | Versão de preço usada |
| quantidade_recebida | INTEGER | > 0 | Peças recebidas |
| custo_total_pago | NUMERIC(14,2) | > 0 | Valor efetivamente pago (sintético) |
| custo_unitario | NUMERIC(14,4) | coluna gerada = custo_total_pago / quantidade_recebida | Custo unitário derivado |
| indice_aplicado | NUMERIC(10,4) | > 0 | Índice usado nesta entrada (cópia histórica) |
| preco_ouro_1000_aplicado | NUMERIC(12,2) NULL | NULL para Folheado | Cópia do valor da versão usada |
| preco_sugerido_unitario | NUMERIC(14,2) NULL | = preco_ouro_1000_aplicado × 1,6 × indice_aplicado (Ouro/Prata); NULL para Folheado | Preço sugerido |
| preco_venda_marcado_unitario | NUMERIC(14,2) | > 0 | Preço marcado nas peças do lote |
| id_execucao, origem_dado | | | Auditoria e marcação |

Inserção por `id_evento_origem` com `ON CONFLICT DO NOTHING`. Custos de entradas anteriores **nunca** são atualizados: o gatilho `tg_fato_compra_item_regras` bloqueia UPDATE. O mesmo gatilho exige um parâmetro do ouro **da mesma data** para Ouro/Prata e proíbe parâmetro e preço sugerido em Folheado.

### dw_demo.fato_venda_item
**Grão:** um produto em uma transação de venda sintética. **Tipo:** transacional.

| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| venda_item_key | BIGINT identity | PK | Chave técnica |
| id_venda_sintetica | VARCHAR(20) | NOT NULL | Dimensão degenerada (`DEMO-VND-NNNNNN`), **artificial**, sem equivalente na fonte real |
| numero_item | SMALLINT | NOT NULL; UNIQUE (id_venda_sintetica, numero_item) | Item dentro da venda |
| id_evento_origem | VARCHAR(30) | UNIQUE NOT NULL | `DEMO-VND-NNNNNN-II`; liga o item à movimentação SAIDA_VENDA |
| data_key | INTEGER | FK dim_data | Data da venda |
| data_hora_venda | TIMESTAMP | NOT NULL | Data e hora da venda |
| produto_key | BIGINT | FK dim_produto | Produto vendido |
| quantidade_vendida | INTEGER | > 0 | Peças vendidas |
| preco_venda_marcado_unitario | NUMERIC(14,2) | > 0 | Preço anunciado |
| preco_vendido_realizado_unitario | NUMERIC(14,2) | > 0; **sem restrição em relação ao marcado** | Preço efetivamente negociado |
| valor_marcado_total | NUMERIC(14,2) | gerada = quantidade × marcado | |
| valor_realizado_total | NUMERIC(14,2) | gerada = quantidade × realizado | **Base do faturamento** |
| diferenca_marcado_realizado | NUMERIC(14,2) | gerada = valor_marcado_total − valor_realizado_total | Positiva = desconto; negativa = venda acima do marcado |
| id_execucao, origem_dado | | | |

Presentes, roubos e ajustes **nunca** geram linha nesta tabela.

### dw_demo.fato_movimentacao_estoque
**Grão:** um evento individual de movimentação de um produto, com data e hora, tipo e quantidade positiva. **Tipo:** transacional.

| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| movimentacao_key | BIGINT identity | PK | Chave técnica |
| id_evento_origem | VARCHAR(30) | UNIQUE NOT NULL | Para compra e venda, igual ao do item comercial |
| data_key | INTEGER | FK dim_data | Data do evento |
| data_hora_evento | TIMESTAMP | NOT NULL | Data e hora do evento |
| produto_key | BIGINT | FK dim_produto | Produto |
| tipo_mov_key | SMALLINT | FK dim_tipo_movimentacao | Tipo (define o sinal) |
| quantidade | INTEGER | > 0 | **Magnitude** do evento, sempre positiva |
| id_execucao, origem_dado | | | |

**Saldo líquido** = Σ (quantidade × dim_tipo_movimentacao.sinal).

### dw_demo.fato_snapshot_estoque
**Grão:** um produto em uma data de referência (fechamento do dia). **Tipo:** snapshot periódico.

| Coluna | Tipo | Restrição | Definição |
|---|---|---|---|
| snapshot_key | BIGINT identity | PK | Chave técnica |
| data_key | INTEGER | FK dim_data; UNIQUE (produto_key, data_key) | Data de referência (último dia de cada mês, configurável) |
| produto_key | BIGINT | FK dim_produto | Produto |
| quantidade_em_estoque | INTEGER | ≥ 0 | Saldo no fechamento; **semiaditivo** (não somar ao longo do tempo) |
| id_execucao, origem_dado | | | |

- **Cálculo:** Σ (quantidade × sinal) das movimentações do produto com `data_hora_evento` < data de referência + 1 dia, incluindo `SALDO_INICIAL`.
- Todos os produtos aparecem em todas as datas, inclusive com saldo 0.

---

## Relacionamentos (modelo semântico)

| De (N) | Para (1) | Chave |
|---|---|---|
| fato_compra_item | dim_produto, dim_data | produto_key, data_key |
| fato_venda_item | dim_produto, dim_data | produto_key, data_key |
| fato_movimentacao_estoque | dim_produto, dim_data, dim_tipo_movimentacao | produto_key, data_key, tipo_mov_key |
| fato_snapshot_estoque | dim_produto, dim_data | produto_key, data_key |
| fato_compra_item | parametro_preco_ouro | parametro_preco_ouro_id (somente SQL/rastreabilidade) |

Não há relacionamento entre fatos. A ligação por `id_evento_origem` serve só para rastreabilidade e testes no SQL.

### dw_demo.controle_carga
Linha única (`id = 1`) com o hash da configuração e a semente que originaram os dados do DW, além da primeira e da última execução. Uma configuração diferente exige reset controlado.

## Schemas de apoio

| Schema | Objetos | Arquivo |
|---|---|---|
| `config_demo` | Tabelas `parametro` (chave/valor tipado, com natureza REGRA_SIMULACAO, PADRAO_SINTETICO ou CONTROLE), `material`, `tipo_peca`, `distribuicao_tipo`, `perfil_movimentacao`, `fator_dia_semana`, `data_comercial`, `afinidade_tipo`. Funções `rand_det`, `rand_entre`, `rand_int`, `poisson_det`, `param_*`, `validar_configuracao`, `hash_configuracao` e as de datas comerciais | `db/migrations/003`, `etl/sql/demo/00`–`02` |
| `staging_demo` | `produto_gerado`, `produto_perfil_simulacao` (técnico), `preco_ouro_gerado`, `entrada_gerada`, `venda_gerada`, `movimento_gerado`, `saldo_final_gerador`. Todas têm PK iniciada por `id_execucao`; as linhas de cada execução são preservadas até o reset | `db/migrations/004`, `etl/sql/demo/11`–`20` |
| `audit_demo` | `execucao`, `etapa`, `rejeicao`, `resultado_validacao`, `correcao_preco_ouro`, `reset_registro`, `migracao_aplicada` | `db/migrations/002`, `etl/sql/demo/10`, `40` |
| `bi_demo` | Views `vw_info_ambiente`, `vw_dim_produto`, `vw_dim_data`, `vw_dim_tipo_movimentacao`, `vw_fato_compra_item`, `vw_fato_venda_item`, `vw_fato_movimentacao_estoque`, `vw_fato_snapshot_estoque`, `vw_preco_ouro`, `vw_preco_ouro_versoes`, `vw_associacao_tipos`, `vw_associacao_produtos` | `db/views/bi_demo_views.sql` |
