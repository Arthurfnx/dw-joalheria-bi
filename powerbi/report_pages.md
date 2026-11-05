# Páginas do relatório (ambiente demonstrativo)

Estado conferido em 2026-11-01 a partir do PBIR em `powerbi/relatorio_joalheria_demo.Report/` (fonte da verdade).
O relatório tem **oito páginas: sete funcionais e uma auxiliar antiga** ("Página 1"). As páginas 1 a 6 foram
construídas e aprovadas pelo usuário em 2026-11-01; a página 7 foi construída numa cópia de trabalho, integrada
ao PBIP e aprovada visualmente pelo usuário em 2026-11-01.

**Comum a todas as páginas funcionais:**
- 1920 × 1080; tema `JoalheriaGrafite` (`StaticResources/RegisteredResources/JoalheriaGrafite-9c41d7a2.json`);
- faixa no topo com o texto fixo **"AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA."**;
- título, subtítulo com as ressalvas da página e segmentações na própria página.

| # | Página | ID PBIR | Visuais | Segmentações |
|---|---|---|---|---|
| 1 | Visão Geral | `a7c3e91f5b2d48e6a0f1` | 14 | Ano, Período, Material |
| 2 | Estoque e Produtos | `b2d4f60a1c3e5a7b9d02` | 13 | Ano, Período, Material, Tipo de peça |
| 3 | Vendas | `c3e5a7b9d1f2a4c6e803` | 14 | Ano, Período, Material, Tipo de peça |
| 4 | Compras e Custos | `d4f6a8c0e2b4d6f8a004` | 14 | Ano, Período, Material, Tipo de peça |
| 5 | Movimentações de Estoque | `e5a7c9e1f3b5d7f9a005` | 15 | Ano, Período, Material, Tipo de peça, Tipo de movimentação |
| 6 | Sazonalidade e Associação | `f6b8d0a2c4e6f8a0b006` | 19 | Ano, Período, Material, Tipo de peça |
| 7 | Análise de Estoque sem Venda e Movimentação | `b7e3c9d1f5a7b9c1d007` | 12 | Ano, Período, Material, Tipo de peça |
| 8 | Página 1 (auxiliar antiga) | `4a3a92664943b10be350` | 0 | — |

A "Página 1" é a página vazia criada com o projeto. É auxiliar e **não** faz parte das sete páginas funcionais; foi
preservada e fica por último na ordem das páginas.

## 1. Visão Geral
- **Métricas:** Receita Realizada, Número de Vendas, Quantidade Vendida, Ticket Médio (cartões "(Exibição)"); Período Selecionado; Data da Posição de Estoque.
- **Visuais:** receita realizada por mês (linha); receita por material (barras); estoque por material (barras); quadro "Sobre os dados desta demonstração".
- **Limitações:** número de vendas e ticket usam o identificador **sintético** de venda; o estoque é a posição de fim de mês mais recente do filtro.

## 2. Estoque e Produtos
- **Métricas:** Estoque Atual (Peças), Produtos Cadastrados, Produtos sem Estoque, Produtos sem Venda no Período, Peso em Estoque Ouro (g).
- **Visuais:** estoque por material e por tipo de peça; evolução mensal do estoque; tabela de produtos; top 10 produtos por quantidade disponível.
- **Limitações:** estoque semiaditivo (último snapshot do filtro, D-042); peso só para Ouro, em gramas, nunca somado a peças; sem estoque valorizado.

## 3. Vendas
- **Métricas:** Receita Realizada, Quantidade Vendida, Número de Vendas, Ticket Médio, Preço Médio Realizado, Desconto sobre Valor Marcado (%).
- **Visuais:** receita por mês; receita por material e por tipo de peça; quantidade por tipo de peça; preço médio marcado × realizado por material; top 10 produtos por receita.
- **Limitações:** receita usa o preço **realizado**; número de vendas e ticket usam IDs sintéticos; os descontos são padrões configurados no gerador; sem margem.

## 4. Compras e Custos
- **Métricas:** Custo Total das Compras, Quantidade Adquirida, Entradas de Compra, Custo Médio Ponderado de Aquisição.
- **Visuais:** custo por mês; custo e quantidade por material; quantidade por tipo de peça; top 10 produtos por custo; tabela de entradas.
- **Limitações:** custo médio ponderado de aquisição **não** é CMV; sem margem, estoque valorizado ou giro; sem fornecedores.

## 5. Movimentações de Estoque
- **Métricas:** Entradas por Compra, Saídas por Venda, Saídas por Presente, Ajustes Positivos, Ajustes Negativos, Estoque Atual (todas em peças).
- **Visuais:** saldo líquido por mês e tipo; eventos e peças por tipo; distribuição por natureza; saldo no fim de cada mês (acumulado das movimentações × snapshot); entradas e saídas por material; tabela de eventos.
- **Limitações:** o sinal vem do tipo de movimentação (D-013); presentes e ajustes não geram receita; `SAIDA_ROUBO` existe na dimensão, mas não tem eventos (roubos desativados na configuração); não somar com as unidades vendidas da página 3.

## 6. Sazonalidade e Associação
- **Sazonalidade (responde aos filtros):** receita por mês; receita mensal por material; tabela "Janelas comerciais" (dias, receita, peças e receita média diária, sem coluna Ano, D-045); receita e peças por janela; cartão de receita média diária nas janelas × demais datas.
- **Associação (não responde aos filtros):** top 10 regras de produtos por lift (mínimo de 5 vendas conjuntas, D-039); regras entre produtos; associação entre tipos de peça; dispersão suporte × confiança dos tipos.
- **Limitações:** a sazonalidade e as afinidades foram **inseridas intencionalmente** pelo gerador e não são conclusões sobre a empresa; associação calculada sobre o histórico completo (jan/2024–dez/2025, D-035) com IDs sintéticos; com dados reais, exige um identificador de venda do sistema operacional.

## 7. Análise de Estoque sem Venda e Movimentação
- **Objetivo:** listar os produtos que têm estoque e mostrar há quanto tempo cada um não é vendido e não é
  movimentado, para apoiar a identificação de estoque parado. É uma análise descritiva: não há faixas de
  classificação, previsão nem valor de estoque.
- **Medidas:** pasta de exibição "06 - Estoque sem Venda e Movimentação" (11 medidas): Última Venda até a
  Referência, Dias sem Venda, Última Movimentação até a Referência, Dias sem Movimentação, Última Entrada por
  Compra, Situação de Venda e Movimentação, Produtos com Estoque, Produtos em Estoque sem Venda Registrada,
  Produtos em Estoque sem Movimentação após o Saldo Inicial, Ordem de Exibição e `_Chave da Ordem de Exibição`
  (oculta). Também usa `[Data da Posição de Estoque]` e `[Estoque Atual (Peças)]`.
- **Cinco cartões:** Data de referência (`[Data da Posição de Estoque]`); Produtos em estoque (`[Produtos com
  Estoque]`, em produtos); Unidades em estoque (`[Estoque Atual (Peças)]`, em peças); Sem venda registrada;
  Sem movimentação após saldo inicial. Uma observação logo abaixo avisa que os produtos sem movimentação também
  estão entre os sem venda registrada (toda venda gera movimentação), portanto os dois cartões não se somam.
- **Duas tabelas, separadas por material** (filtro fixo no visual, bloqueado):
  - **Ouro — produtos com estoque:** #, Código, Produto, Tipo de peça, Tamanho, Peso unitário (g), Estoque,
    Última venda, Dias sem venda, Última movimentação, Dias sem movimentação, Última compra, Situação;
  - **Prata e Folheado — produtos/modelos com estoque:** as mesmas colunas, com Material no lugar de Tamanho e
    Peso unitário.

  As duas mostram somente produtos com `[Estoque Atual (Peças)]` maior que zero (filtro fixo no visual). As
  colunas de dias têm gradiente de cor (branco → dourado claro); célula vazia fica sem cor.
- **Data de referência:** é `[Data da Posição de Estoque]`, a posição de estoque (fim de mês) mais recente dentro
  do filtro. Não usa a data de hoje (`TODAY()`). Com um período que termina no meio do mês, a referência é o fim
  do mês anterior.
- **Última venda e última movimentação:** consideram **todo o histórico até a data de referência**, ignorando o
  início do período filtrado. Uma venda anterior ao período continua sendo a última venda.
  - "Última movimentação" **exclui `SALDO_INICIAL`** (implantação do estoque) e ignora o filtro de tipo de
    movimentação. Considera compras, vendas, presentes e ajustes.
  - "Última compra" = último evento de natureza `entrada` (nesta demo, somente `ENTRADA_COMPRA`), sem
    `SALDO_INICIAL` e sem `AJUSTE_POSITIVO`.
  - Vazio em "Última venda" significa nunca vendido até a referência; vazio em "Última movimentação" significa
    sem movimentação após o saldo inicial.
- **Situação** (texto, por produto): "Nunca vendido · sem movimentação após o saldo inicial"; "Nunca vendido ·
  com movimentação registrada"; "Já vendido · ver dias sem venda".
- **Ordenação de prioridade (coluna #, critério padrão das duas tabelas):**
  1. nunca vendidos e sem movimentação após o saldo inicial (mais unidades primeiro);
  2. nunca vendidos com movimentação (movimentação mais antiga primeiro);
  3. já vendidos (mais dias sem venda; no empate, mais dias sem movimentação).

  Desempate final pela chave do produto. A numeração vai de 1 a N entre os produtos com estoque que restam
  depois dos filtros e não altera nenhum indicador. Clicar em outro cabeçalho reordena a tabela; a coluna #
  continua mostrando a prioridade.
- **Filtros:** Período e Ano definem a data de referência. Material e Tipo de peça restringem cartões e tabelas.
  Quando o filtro de Material exclui o material de uma tabela, ela aparece só com o cabeçalho, sem mensagem.
- **Valores sem filtros (referência 31/12/2025):** 132 produtos em estoque; 520 peças; 15 sem venda registrada;
  9 sem movimentação após o saldo inicial.
- **Limitações:**
  - a granularidade é o **produto/modelo** (código), não a unidade física: um código pode ter várias unidades,
    e "dias sem venda" não indica há quanto tempo cada unidade está em estoque. No ouro, a dimensão atual também
    não identifica peças individuais;
  - a chave de ordenação pressupõe estoque e dias menores que 1.000, o que vale para o histórico atual
    (jan/2024–dez/2025);
  - dados sintéticos: os produtos parados resultam do gerador, não do comportamento real da empresa.

## Fora do relatório
- Clientes (fora do escopo).
- Margem bruta, CMV, estoque valorizado e giro por custo (fora da fase 1).
- Previsão de demanda.
- Tabelas `vw_preco_ouro`, `vw_preco_ouro_versoes` e `vw_info_ambiente`: importadas, mas sem uso nas páginas.
