# Especificação dos dados demonstrativos (sintéticos)

> **Todos os dados descritos aqui são SINTÉTICOS** (`origem_dado = 'SINTETICO_DEMO'`). Não representam produtos, preços, volumes, períodos nem o comportamento comercial reais da joalheria. Nenhum registro, código, descrição ou valor das planilhas reais (CLS, RAMON, FOLHEADOS) é usado.

## 1. Classificação das regras

| Tipo | Significado |
|---|---|
| **Regra de negócio confirmada** | Informada pelo usuário/parceiro; vale também para a fase real |
| **Regra da simulação** | Mecanismo técnico para gerar dados plausíveis; **não** é política da empresa |
| **Padrão sintético inserido** | Comportamento colocado intencionalmente para demonstrar um visual do Power BI |

### Regras de negócio confirmadas
- Material (Ouro, Prata, Folheado) e tipo de peça (Anel, Brinco etc.) são conceitos distintos.
- **Ouro:** peso em gramas; índice de precificação; tamanho/Ômega quando for anel.
- **Prata:** índice; tamanho quando aplicável; peso não é exigido.
- **Folheado:** índice; tamanho quando aplicável a anéis; sem peso; sem aplicação automática da fórmula do ouro.
- `PREÇO SUGERIDO = PREÇO DO OURO 1000 NA DATA DE REFERÊNCIA × 1,6 × ÍNDICE`, **somente para Ouro e Prata**.
- O preço do ouro é informado manualmente uma vez por data de referência e nunca é buscado na internet.
- O custo pago pertence ao registro de entrada; um mesmo produto pode ter custos diferentes em entradas distintas.
- Preço sugerido, preço de venda marcado e preço vendido realizado são distintos; nenhum sobrescreve o outro.
- Faturamento = soma do valor **realizado** das vendas válidas.
- Compras aumentam o estoque. Vendas reduzem o estoque e geram registro comercial. Presentes e roubos reduzem o estoque **sem** faturamento. Ajustes alteram o saldo e não são vendas.

### Regras da simulação
- Fórmulas de custo sintético, arredondamento e variação do preço marcado, variação entre preço marcado e realizado.
- Gatilho e prazo de reposição. **Não é estoque mínimo nem política de compras do parceiro.**
- Perfis de movimentação por produto.
- Horário de funcionamento e distribuição de horários dos eventos.
- Série do preço do ouro, sempre com `unidade_referencia = 'NAO_CONFIRMADA_DEMO'`. **Não** é cotação oficial nem preço por grama.

### Padrões sintéticos inseridos
- Fatores sazonais em datas comerciais (Dia das Mães, Dia dos Namorados, Black Friday, Natal).
- Afinidades entre tipos de peça (pares com maior probabilidade de sair na mesma venda).
- Proporções de vendas abaixo, iguais e acima do preço marcado.

Os relatórios **vão encontrar** esses padrões porque eles foram inseridos. Isso demonstra os visuais, mas não é uma descoberta sobre a empresa.

## 2. Parâmetros configuráveis (sugestões iniciais)

Ficam em tabelas de `config_demo`: `parametro`, `material`, `tipo_peca`, `distribuicao_tipo`, `perfil_movimentacao`, `fator_dia_semana`, `data_comercial` e `afinidade_tipo`. Os valores padrão estão em `etl/sql/demo/00_config_padrao.sql`; eles são inseridos com `ON CONFLICT DO NOTHING` e não sobrescrevem as edições do usuário. Os valores abaixo são **sugestões para demonstração acadêmica**, não fatos sobre a empresa.

| Parâmetro | Sugestão | Justificativa |
|---|---|---|
| Semente | 20261031 | Reprodutibilidade: mesma configuração → mesmos dados |
| Quantidade de produtos | 150 | Permite rankings e cauda longa, mantendo a conferência manual viável |
| Distribuição por material | 1/3 Ouro, 1/3 Prata, 1/3 Folheado | Comparação equilibrada entre famílias |
| Distribuição de tipos de peça por material | Tabela de pesos material × tipo; **todas as combinações são permitidas** | Ajustável sem restrições artificiais |
| Período | 2024-01-01 a 2025-12-31 | Dois anos completos: comparação ano a ano e duas ocorrências de cada data comercial |
| Funcionamento | Segunda a sábado, 09h–18h | Gera data e horário dos eventos |
| Saldo inicial por produto | Ouro 1–3, Prata 2–6, Folheado 3–8 peças | Estoque de abertura (`SALDO_INICIAL`) |
| Frequência de vendas | ~6 transações por dia útil (base) | Cerca de 3.700 vendas em 2 anos; volume suficiente para associação |
| Itens por transação | 1: 65%; 2: 25%; 3: 10% | Gera cestas para a análise de associação |
| Marcado × realizado | 50% igual; 42% abaixo (−3% a −15%); 8% acima (+1% a +5%) | Demonstra a diferença nos dois sentidos |
| Sazonalidade (padrão inserido) | Multiplicadores nas janelas que antecedem as datas comerciais | Visuais de sazonalidade |
| Afinidades (padrão inserido) | Pares de tipos com probabilidade adicional de compra conjunta | Suporte, confiança e lift |
| Perfis de movimentação | Alta 20%, média 40%, baixa 25%, parado 10%, interrompido 5% | Ranking e produtos sem movimentação |
| Reposição (regra da simulação) | Saldo-gatilho e prazo de chegada configuráveis | Gerar compras ao longo do tempo |
| Frequência de compras | Gatilho de reposição + ciclos periódicos configuráveis | Distribuir as entradas no período |
| Presentes | Taxa configurável (por exemplo, 1 evento a cada ~25 dias úteis) | Saída sem faturamento |
| Roubos | **0 (desativado na simulação padrão desta fase)** | O tipo `SAIDA_ROUBO` permanece previsto na arquitetura (dimensão, regras de saída sem faturamento, testes de não faturamento), mas não é gerado por padrão |
| Ajustes | Contagem periódica (por exemplo, trimestral) sobre uma fração dos produtos, ±1 peça | Ajustes positivos e negativos |
| Datas de snapshot | Último dia de cada mês | Evolução mensal do estoque |
| Série do preço do ouro | Valor-base e variação diária configuráveis, **para todos os dias do período** | Toda entrada encontra preço na mesma data |

Os perfis:
- **parado:** não vende em todo o período;
- **interrompido:** deixa de vender nos últimos N meses configurados.

**Detalhes do mecanismo (regras da simulação):**
- O número de vendas por dia segue uma distribuição de Poisson com média = base × fator do dia da semana × fator sazonal. Domingo tem fator 0 (loja fechada).
- Os produtos de cada venda são escolhidos com probabilidade proporcional ao peso do perfil, apenas entre os que têm saldo.
- A 2ª e a 3ª peça da venda seguem a afinidade do tipo da 1ª peça com probabilidade `prob_item_por_afinidade`.
- Roubos: **não fazem parte da simulação padrão desta fase** (`roubos_por_ano = 0`). O tipo `SAIDA_ROUBO` continua na dimensão de tipos de movimentação para evolução futura; se o parâmetro for alterado, a probabilidade diária será roubos_por_ano × anos ÷ dias de funcionamento (alterar a configuração exige reset controlado). O teste `MOV-00` exige apenas `SALDO_INICIAL`, `ENTRADA_COMPRA` e `SAIDA_VENDA`.
- Ajustes: no dia `ajuste_dia_mes` dos meses múltiplos de `ajuste_intervalo_meses` (contados a partir do início), cada produto tem a probabilidade `ajuste_fracao_produtos` de sofrer ajuste ±1. O ajuste negativo só ocorre com saldo ≥ 1.
- Reposição por gatilho TÉCNICO: quando o saldo fica ≤ `reposicao_saldo_gatilho` e não há pedido pendente, a chegada é programada entre `reposicao_prazo_min_dias` e `reposicao_prazo_max_dias`. Produtos "interrompidos" não são repostos no período final.
- Reforço: a cada `reforco_ciclo_dias`, os produtos de giro alto ou médio sem pedido pendente recebem compra com probabilidade `reforco_probabilidade`.
- As chegadas acontecem no primeiro dia de funcionamento ≥ data programada, às `hora_abertura`. Os itens que chegam no mesmo dia formam uma única entrada (`DEMO-ENT-NNNNNN`).

## 3. Catálogo sintético

- **Códigos:** `DEMO-OURO-0001`, `DEMO-PRATA-0001`, `DEMO-FOLHADO-0001`, numerados de forma sequencial em cada material.
- **Descrição:** gerada por modelo genérico (por exemplo, "Anel Ouro DEMO 0007"), sem copiar nada das planilhas.
- **Tamanho/Ômega:** **obrigatório somente para Anel**, em qualquer material. Nos demais tipos, inclusive Aliança, fica nulo nesta demo, até haver confirmação específica.
- **Peso:** obrigatório (> 0, em gramas) para Ouro e nulo para Prata e Folheado.
- **Índice de precificação:** sempre > 0, gerado dentro de faixas configuráveis por material. No Ouro, é correlacionado ao peso.
- **Perfil de movimentação:** atributo técnico do gerador, guardado em `staging_demo.produto_perfil_simulacao`. **Não** faz parte de `dim_produto` e não aparece nos relatórios.

## 4. Preço do ouro e preços

- **Série sintética:** um valor por dia do período em `dw_demo.parametro_preco_ouro`, versão 1, `vigente = true`, `unidade_referencia = 'NAO_CONFIRMADA_DEMO'`.
- **Entradas de Ouro e Prata:** referenciam o parâmetro vigente **da mesma data**. Se não houver, a entrada é rejeitada e registrada em `audit_demo.rejeicao`; não há busca automática de uma data anterior.
- **Correção de preço:**
  - a procedure `dw_demo.corrigir_preco_ouro(data, valor, motivo)` cria uma nova versão e desativa a anterior;
  - não há UPDATE nem DELETE de valores;
  - as entradas já registradas mantêm o `parametro_id` e a cópia do valor usados.

**Fórmulas de preço:**

| Valor | Ouro e Prata | Folheado |
|---|---|---|
| Custo (regra da simulação) | preço do ouro (data) × índice × fator de custo sintético | faixa sintética por tipo de peça |
| Preço sugerido (regra confirmada) | preço do ouro × 1,6 × índice | NULL |
| Preço marcado (regra da simulação) | preço sugerido com arredondamento e variação sintética | custo × markup sintético |
| Preço realizado (regra da simulação) | preço marcado × (1 + variação), com variação negativa, nula ou positiva conforme a configuração | idem |

## 5. Simulação diária

Para cada dia do período, em ordem:
1. No primeiro dia, às 00:00, ocorre o `SALDO_INICIAL` de todos os produtos.
2. Chegam as reposições programadas (`ENTRADA_COMPRA`), agrupadas por entrada (`DEMO-ENT-NNNNNN`).
3. Vendas (`DEMO-VND-NNNNNN`):
   - o número de transações = base × fatores (dia da semana e sazonalidade);
   - os itens são escolhidos pelos pesos de perfil, apenas entre produtos com saldo, com afinidade para itens adicionais.
4. Ocorrem presentes (e roubos, somente se `roubos_por_ano` > 0 — desativado por padrão), conforme taxas, somente em produtos com saldo.
5. Nas datas de contagem configuradas, ocorrem ajustes, sem nunca deixar saldo negativo.
6. Os produtos que atingirem o gatilho de reposição recebem uma entrada programada após o prazo.

O saldo é mantido pelo gerador e **nunca fica negativo**.

**Identificadores de evento de origem (`id_evento_origem`), sintéticos:**

| Evento | Formato |
|---|---|
| Item de entrada | `DEMO-ENT-000045-003` |
| Item de venda | `DEMO-VND-000123-01` |
| Saldo inicial | `DEMO-SIN-…` |
| Presente | `DEMO-PRS-…` |
| Roubo | `DEMO-ROU-…` (não gerado na simulação padrão) |
| Ajuste positivo | `DEMO-AJP-…` |
| Ajuste negativo | `DEMO-AJN-…` |

Os identificadores de venda são **artificiais**. A fonte real conhecida **não** possui identificador de transação. Para usar ticket médio e associação com dados reais, o futuro sistema operacional precisará gerar um identificador único de venda que agrupe todos os seus itens.

## 6. Reprodutibilidade e reexecução

- A mesma configuração (hash) e a mesma semente produzem exatamente os mesmos registros. Isso é verificado por teste com md5 do conteúdo ordenado.
- **Reexecução com o mesmo hash:** a carga usa `ON CONFLICT (id_evento_origem) DO NOTHING`, então nada é duplicado.
- **Hash diferente:** a execução é recusada até que se rode `scripts/reset_demo.ps1`. O script limpa apenas `staging_demo` e `dw_demo`, preserva `config_demo` e o histórico de `audit_demo`, e exige confirmação explícita.

## 7. O que a simulação NÃO prova

A presença de identificador de venda, data e custo de aquisição, quantidade recebida e motivo de saída na simulação **não** significa que esses campos existam nas fontes reais. Eles são requisitos do futuro sistema operacional (ver `docs/pending_questions.md`).
