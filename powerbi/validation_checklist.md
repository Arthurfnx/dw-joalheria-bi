# Checklist de validação do Power BI contra o DW

**Status:** executado. Base: execução 3 de `audit_demo.execucao`, período completo (01/01/2024 a 31/12/2025), sem filtros.

**Como foi feito:**
- **Lado SQL:** as consultas abaixo foram executadas em 2026-11-01, em `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`. As conferências por página estão em `tests/reconciliacao/`.
- **Lado Power BI:** durante a construção de cada página (2026-11-01), as medidas foram avaliadas com consultas DAX pelo Power BI Modeling MCP e comparadas manualmente com o SQL. A comparação não é automatizada.
- **"Conferido"** = o valor DAX coincidiu com o SQL durante a construção. **"Não conferido no Power BI"** = só o lado SQL foi registrado; falta comparar com o visual.

## Pré-condições
- [x] `scripts/run_demo_etl.ps1` terminou com SUCESSO (execuções 2 e 3).
- [x] `scripts/run_tests.ps1 -ComReexecucao` passou (execução 3: 24/24, REP-01 e REP-02).
- [x] O aviso "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA." aparece nas sete páginas funcionais (conferido no PBIR).
- [x] O PBIP tem 8 páginas (7 funcionais e a "Página 1", auxiliar antiga) e 61 medidas na tabela `Medidas` (50 das páginas 1 a 6 e 11 da página 7, sem nomes duplicados), conferido em `pages.json` e `Medidas.tmdl` em 2026-11-01.
- [x] Conexão fixa em `localhost:5432`, banco `dw_joalheria`, esquema `bi_demo` (não há parâmetro; ver `powerbi/connection_guide.md`).
- [x] Não há relacionamento entre tabelas fato (conferido em `relationships.tmdl`).

## Conferências numéricas

| # | Indicador | Resultado SQL | Medida / visual | Situação |
|---|---|---|---|---|
| 1 | Estoque atual (peças), sem filtro | 520 (31/12/2025) | `[Estoque Atual (Peças)]` | Conferido |
| 2 | Estoque atual por material | Folheado 223; Ouro 97; Prata 200 | "Estoque por material" (páginas 1 e 2) | Não conferido no Power BI (a soma, 520, foi conferida) |
| 3 | Peso em estoque Ouro (g) | 410,345 | `[Peso em Estoque Ouro (g)]` | Conferido |
| 4 | Entradas (peças) | 7.380 | `[Entradas de Estoque (Peças)]` | Conferido |
| 5 | Saídas por tipo | venda 6.819; presente 20; ajuste negativo 21 | cartões da página 5 | Conferido |
| 6 | Saldo líquido = último saldo | 520 = #1 | `[Saldo Líquido Movimentado]` | Conferido |
| 7 | Quantidade adquirida | 6.773 | `[Quantidade Adquirida]` | Conferido |
| 8 | Custo total das compras | R$ 3.995.958,71 | `[Custo Total das Compras]` | Conferido |
| 9 | Custo médio ponderado de aquisição | R$ 589,98 | `[Custo Médio Ponderado de Aquisição]` | Conferido |
| 10 | Quantidade vendida | 6.819 | `[Quantidade Vendida]` | Conferido |
| 11 | Receita realizada | R$ 6.701.258,34 | `[Receita Realizada]` | Conferido |
| 12 | Diferença marcado × realizado | R$ 238.156,66 (desconto de 3,43% sobre o valor marcado) | `[Desconto sobre Valor Marcado (%)]` | Conferido (percentual) |
| 13 | Número de vendas (sintético) | 4.415 | `[Número de Vendas]` | Conferido |
| 14 | Ticket médio (sintético) | R$ 1.517,84 | `[Ticket Médio]` | Conferido |
| 15 | Receita por ano | 2024: R$ 3.166.042,46; 2025: R$ 3.535.215,88 | segmentação Ano | Não conferido no Power BI |
| 16 | Variação a/a | +11,66% (calculada a partir do #15) | — | Não há medida a/a no modelo |
| 17 | Receita por janela comercial | Natal R$ 825.841,68; Dia das Mães R$ 234.952,75; Dia dos Namorados R$ 171.120,07; Black Friday R$ 129.840,32; demais datas R$ 5.339.503,52 | tabela "Janelas comerciais" (página 6) | Conferido (`conferir_janelas_comerciais.ps1`) |
| 18 | Produtos sem venda no período completo | 15 (também 15 com o filtro de estoque > 0 da medida) | `[Produtos sem Venda no Período]` | Conferido |
| 19 | Top 3 regras de tipos por lift | Pingente → Corrente 2,748333; Corrente → Pingente 2,748333; Cordão → Pingente 1,344022 | "Associação entre tipos de peça" | Não conferido no Power BI (o total de 90 regras foi conferido) |
| 20 | Presentes e roubos sem receita | 0 itens de venda ligados a movimentos não comerciais | — | Verificação estrutural, só SQL |

Conferências adicionais da página 6 (`conferir_sazonalidade_associacao.ps1`, conferidas com o Power BI): média diária R$ 15.834,36 nas janelas × R$ 8.278,30 nas demais datas (+91,3%); 3.396 regras de produtos, 52 com ≥ 5 vendas conjuntas; 10º lift do ranking 7,178862.

## Conferências qualitativas
- [x] Nenhum visual soma `quantidade_em_estoque` ao longo do tempo (as medidas de estoque usam o último snapshot).
- [x] Nenhum visual soma peso com peças.
- [x] A receita usa `valor_realizado_total`, nunca o valor marcado.
- [x] A página 6 informa que IDs, sazonalidade e afinidades são sintéticos e que a associação não responde aos filtros.
- [x] Não há visual de clientes, margem, estoque valorizado ou giro por custo.

## Página 7 — Análise de Estoque sem Venda e Movimentação

**Como foi feito (2026-11-01):** a página e as 11 medidas foram construídas numa cópia de trabalho do PBIP e
integradas depois ao PBIP oficial. A página e o `Medidas.tmdl` integrados são idênticos aos da cópia validada
(13 arquivos da página com JSON idêntico; bloco das medidas idêntico byte a byte).
- **Lado SQL:** consulta independente em `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`, que recalcula por produto a
  data de referência, o estoque, a última venda, a última movimentação sem `SALDO_INICIAL` e a última entrada.
  Para comparar datas e dias por produto, usa somas ponderadas pela chave do produto. O script ficou na área
  temporária da sessão e **não** está em `tests/reconciliacao/`.
- **Lado Power BI:** consultas DAX pelo Power BI Modeling MCP na cópia de trabalho e capturas da página
  renderizada pelo Power BI Desktop.

### Executados e aprovados

| # | Teste | Resultado | Evidência |
|---|---|---|---|
| P7-1 | Produtos e unidades em estoque, sem filtro | 132 produtos; 520 peças; referência 31/12/2025 | SQL = DAX = cartões |
| P7-2 | Produtos sem venda registrada | 15 | SQL = DAX = cartão |
| P7-3 | Produtos sem movimentação após o saldo inicial | 9 (subconjunto dos 15) | SQL = DAX = cartão |
| P7-4 | Comparação SQL × DAX por produto (contagens e somas ponderadas de última venda, dias sem venda, última movimentação, dias sem movimentação, última entrada e grupos de situação) | Idênticos nos 7 cenários: sem filtro; período 01/01–30/06/2025; ano 2024; Ouro; Prata + Folheado; Anel; Ouro + período 01/01–30/06/2025 | Consultas SQL e DAX |
| P7-5 | Última venda anterior ao período filtrado | Período 01/01–15/06/2025: `DEMO-OURO-0015` exibe última venda em 11/03/2024 (446 dias) | Captura da página e SQL |
| P7-6 | Exclusão de `SALDO_INICIAL` da última movimentação | A medida exclui `codigo_tipo = "SALDO_INICIAL"`; os valores por produto coincidem com o SQL, que aplica a mesma exclusão (P7-4) | TMDL e P7-4 |
| P7-7 | Período terminando no meio do mês | Período 01/01–15/06/2025: referência 31/05/2025; 137 produtos, 627 peças, 15 sem venda, 9 sem movimentação | Captura e SQL |
| P7-8 | Separação por material | Material = Ouro: 41 / 97 / 5 / 3, tabela Prata e Folheado vazia. Ano 2024 + Prata e Folheado: referência 31/12/2024, 95 / 522 / 10 / 6, tabela de Ouro vazia. Período de P7-7 + Anel: 28 / 116 / 2 / 1, só anéis | Capturas e SQL |
| P7-9 | Ordenação de prioridade | Coluna # contínua de 1 a 41 (Ouro) e de 1 a 91 (Prata e Folheado), sem repetição e sem inversão de grupo ou de dias | Consulta DAX |
| P7-10 | Reordenar por outra coluna | Ordenando por dias sem movimentação, o layout se mantém e a coluna # continua mostrando a prioridade | Captura |
| P7-11 | Integridade das páginas existentes após a integração | As páginas 1 a 6 e a "Página 1" estão idênticas ao commit `215963f` (96 arquivos); na página 6, a tabela "Associação entre tipos de peça" segue ordenada por Lift decrescente (`isDefaultSort: true`); as 50 medidas anteriores estão intactas | Comparação de hashes Git |
| P7-12 | Validação PBIR | Mesmo resultado das páginas 1 a 6 (2 erros antigos de `$schema` no `.pbip` e no `definition.pbir`, 1 aviso de esquema inacessível) | `powerbi-report-author validate` |
| P7-13 | Inspeção visual do PBIP integrado | Aprovada pelo usuário no Power BI Desktop | Declaração do usuário (2026-11-01) |

Os cenários de P7-5, P7-7, P7-8 e P7-10 também foram renderizados pelo Power BI Desktop; os números da tela
coincidiram com o SQL.

### Ainda não realizados
- Conferência da página 7 por script versionado em `tests/reconciliacao/`: a consulta SQL usada não foi incorporada ao repositório.
- Cliques reais nos slicers e nos cabeçalhos feitos durante a construção: os cenários foram simulados (ver limitações). A inspeção visual do usuário (P7-13) não percorreu esses cenários um a um.
- Conferência numérica da página 7 no PBIX com dados importados: só existe a declaração do usuário de que o PBIX abriu offline com os dados corretos.

### Limitações conhecidas
- **Cliques simulados.** Nos testes de interação, o estado de cada slicer e a ordenação foram gravados na definição da cópia de trabalho, no mesmo formato em que o Desktop salva um clique, e a página foi recarregada. Nas capturas, a caixa do slicer de Período mostra o intervalo padrão, embora o filtro esteja aplicado.
- **Tabela vazia sem aviso.** Quando o filtro de Material exclui o material de uma tabela, ela aparece só com o cabeçalho, sem mensagem.
- **Granularidade.** Os dias valem para o produto/modelo, não para cada unidade física.
- **Chave de ordenação.** Pressupõe estoque e dias menores que 1.000 (válido para jan/2024–dez/2025).

## Pendências de validação
- Comparar no Power BI os itens #2, #15 e #19.
- Página 7: ver "Ainda não realizados".
- Os valores acima valem para a configuração e o ETL atuais; qualquer mudança exige nova conferência.
