# Inventário das fontes de dados reais

**Status:**
- Inspecionadas em 2026-10-31, em modo **somente leitura**: os XLSX foram lidos como ZIP/XML, sem alteração dos originais.
- **As fontes reais NÃO são usadas na fase 1 (demonstrativa).** Este inventário serve à fase 2 (integração real). As regras abaixo **não** são aplicadas agora.
- Por privacidade, este documento não reproduz nomes de clientes, nomes de pessoas, dados de contato nem registros individuais.

## Arquivos em `data/raw/`

| Arquivo | Tipo | Papel |
|---|---|---|
| `Tabela de preços de Folheados e prata.xlsx` | XLSX, 3 abas | Fonte operacional principal (estoque, compras e vendas em colunas) |
| `CLS Tabela por indice Excel (2020_04_08 22_12_40 UTC).xlsx` | XLSX, 1 aba | Catálogo de ouro (conforme o usuário) |
| `Orientacoes_BI_DataWarehouse.pdf`, `Projeto_Data_Warehouse_Joalheria_visualizacao.pdf`, `TEMPLATE PROJETO BI versão 2 26-1.docx`, `Eixo 4 - Sustentabilidade.docx` | PDF/DOCX | Documentos acadêmicos de referência, **não** são fontes de dados. Copiados (não movidos) para `docs/referencia/`, que é ignorada pelo Git. O DOCX do Eixo 4 contém dados pessoais do parceiro |

**Não foram encontrados:**
- arquivo separado de compras;
- arquivo separado de vendas;
- fonte de estoque de ouro com saldos;
- fonte de relógios;
- histórico de snapshots.

## 1. `Tabela de preços de Folheados e prata.xlsx`
Metadados: criado em 2024-07-24 e modificado em 2026-10-18.

### Aba FOLHEADOS (fonte principal)
- **Título** (linha 1): "PLANILHA DE ESTOQUE DE FOLHEADOS – valor do índice atual R$ 960,00".
- **Cabeçalho:** linha 2.
- **Dados:** 1.541 linhas (linhas 3–1543), mais linhas de totais nas linhas 1546–1547.
- **Filtro automático:** A2:M1543.

| Coluna | Nome | Preenchidas | Observações |
|---|---|---|---|
| A | CODIGO | 1.541 | Padrões `N-NNNN` (1.262), `R07NNNNN` (275, prata) e "Serviço" (4). O prefixo numérico sugere o tipo de peça (1 = anel, 4 = brinco, 6 = cordão, 7 = corrente, 8 = pingente, 10 = pulseira, 11 = tornozeleira, 16 = conjunto…), a confirmar. 6 códigos repetidos, com descrições diferentes |
| B | DESCRIÇÃO | 1.541 | Texto livre; 948 distintas; grafias variadas ("BRINCO", "BINCO", "BRNCO") |
| C | VALOR DE COMPRA | 1.541 | Moeda R$; 15 células com fórmula (índice × constante); soma de cerca de R$ 109 mil na linha de total |
| D | PESO | 565 | 0,08 a 51,5; unidade não declarada |
| E | TAMANHO | 365 | Grafias mistas ("16", "T16", "T 16") |
| F | INDICE | 1.541 | Razão custo/índice variável (200, 292, 167, 250, 385…); semântica a confirmar |
| G | LOCAL DO ESTOQUE | 1.440 | Valores: ESTOQUE, MALETA 1, ARMARIO, 2 MALETA, VENDIDO, "novo", "sumiu", nome de pessoa (128) e vazio (101) |
| H | DATA DA COMPRA | 693 | 11 datas distintas (lotes) entre 2025-01-02 e 2026-06-28; 848 sem data |
| I | VALOR DE VENDA | 119 | **19 com R$ 0,01** |
| J | DATA VENDA | 118 | 2024-10 a 2026-10-17; 1 data inválida (serial 1 = 1899-12-31) |
| K | CLIENTE | 132 | Nomes de pessoas (dado pessoal; 58 distintos); 16 com cliente e sem valor de venda |
| L | LUCRO DA VENDA | 1.492 | Fórmula `SE(venda > 0; venda − compra; 0)` |
| M | (sem título) | 1 | Anotação "A receber" |

**Observações para a fase 2:**
- Não há coluna de quantidade. Hipótese: 1 linha = 1 peça física.
- Não há identificador de transação. Há 20 grupos de cliente + data com mais de uma peça, mas isso **não** é ID de venda.
- 11 peças têm venda registrada com local diferente de "VENDIDO".
- Vendas a R$ 0,01: significado desconhecido (presente? valor não anotado?). Não devem entrar no faturamento sem confirmação.

### Aba RAMON - PEÇAS
- **Título:** "MERCADORIA DE PRATA DO RAMON".
- **Cabeçalho** (linha 2): CODIGO, DESCRIÇÃO, VALOR DE COMPRA, VALOR DE VENDA, INDICE DE VENDA, DATA DA VENDA, TAMANHO, CLIENTE, VALOR VENDIDO.
- **Peças:** cerca de 280 peças com código `R07NNNNN`, além de serviços e consertos.
- **274 dos 275 códigos R também existem em FOLHEADOS, com o mesmo custo:** risco de duplicidade.
- O bloco de códigos `R0721…` (linhas ~115–214) tem **colunas deslocadas**: valores pequenos em "VALOR DE VENDA" e datas na coluna "CLIENTE".
- INDICE DE VENDA = valor de venda ÷ 680 em parte das linhas.
- **Linhas 288–301:** total, 10 lançamentos de "PAGAMENTO PARCIAL" (2024-08 a 2026-07) e "TOTAL A PAGAR". É o registro de contas a pagar ao fornecedor: **fora do escopo**.

### Aba CATEGORIAS
Contém uma única célula ("16 conjunto"). É uma legenda incompleta de prefixos.

## 2. `CLS Tabela por indice Excel (…).xlsx`
- **Metadados:** criado e modificado em 2019-06-16.
- **Estrutura:** 1 aba e 1.140 linhas de dados.
- **Colunas:** CODIGO (texto, 4 dígitos, único), CATEGORIA (18 grafias: anel, brinco, pingente, pulseira, relógio, cordão, corrente, colar, piercing…; maiúsculas e minúsculas misturadas), DESCRIÇÃO, PESO (1.139 preenchidos), Ø (389 preenchidos), Ind Preço (1.117 preenchidos).
- **Não tem:** datas, quantidades, custos ou valores em R$.
- Segundo o usuário, é o **catálogo de ouro**.

## Intenção de integração futura

| Fonte | Conteúdo previsto | Principais tratamentos a definir |
|---|---|---|
| CLS | catálogo de ouro | normalizar categoria; definir chave; relação com o estoque real de ouro |
| RAMON | peças de prata | deduplicar contra FOLHEADOS; corrigir o bloco deslocado; ignorar o registro de pagamentos |
| FOLHEADOS | peças folheadas e prata; compras e vendas em colunas | confirmar o grão (peça); tratar R$ 0,01, "sumiu", "novo", local com nome de pessoa, códigos repetidos, data inválida e "Serviço" |

Na transição, o histórico real fica separado do sintético. A ausência de campos nas fontes reais (ID de venda, motivo de saída, data e custo de todas as entradas) **não** pode ser mascarada pela simulação.
