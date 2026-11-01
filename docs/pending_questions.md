# Perguntas e decisões pendentes

## Fase 1 (demonstrativa)

A fase 1 foi executada e o relatório aprovado em 2026-11-01. Itens resolvidos e itens ainda abertos:

| Item | Situação | Impacto |
|---|---|---|
| Criar o banco `dw_joalheria` | **Resolvido** (2026-10-31) | — |
| Aplicar migrations e executar ETL e testes | **Resolvido**: 21 migrations; execuções 2 e 3 com 24/24 | — |
| Usuário de banco somente leitura para o Power BI | **Resolvido**: `bi_leitura` criado e validado | — |
| Qual usuário está gravado nas credenciais do Power BI Desktop | **Pendente de confirmação** (as credenciais ficam no Desktop, fora do PBIP) | Se for `postgres`, o relatório lê com um superusuário; recomenda-se `bi_leitura` |
| Métricas de associação do período completo (views SQL) ou dinâmicas por filtro de data (DAX) | Implementado: período completo (D-035); ranking com mínimo de 5 vendas conjuntas (D-039) | Se quiser filtrar por data, será preciso uma tabela de cestas e medidas DAX adicionais |
| Parametrização da conexão do Power BI (servidor, banco, esquema) | Melhoria futura, **não implementada** | Hoje a troca de ambiente exige editar as 12 consultas |
| Página auxiliar "Página 1" (vazia) no relatório | Mantida; não é uma das seis páginas principais | Remover ou ocultar depende de decisão do usuário |
| Valores dos parâmetros da simulação (volumes, período, proporções, fatores) | Sugestões em `etl/sql/demo/00_config_padrao.sql`, ajustáveis em `config_demo` | Mudar a configuração exige reset controlado |
| Lista de tipos de peça e pesos por material | Configurável; não há restrição de tipo por material | — |
| Obrigatoriedade de tamanho para outros tipos além de Anel (por exemplo, Aliança) | Não exigida até confirmação específica (`config_demo.tipo_peca.exige_tamanho`) | — |
| Roubos na simulação | Desativados por padrão (`roubos_por_ano = 0`); `SAIDA_ROUBO` permanece na dimensão | Reativar exige alterar a configuração e fazer reset controlado |
| Power BI Desktop | **Resolvido**: instalado; conexão, medidas e páginas conferidas contra o SQL | — |

## Fase 2 (integração real) — perguntas para o parceiro

| Pergunta | Por que importa | Evidência observada |
|---|---|---|
| Qual é a unidade de referência do "preço do ouro 1000"? | Fórmula do preço sugerido; hoje marcada como `NAO_CONFIRMADA_DEMO` | Não informada |
| Cada linha da aba FOLHEADOS representa uma única peça física? | Define a quantidade e o grão dos fatos | Não há coluna de quantidade |
| O que significa VALOR DE VENDA = R$ 0,01 (19 casos)? | Presente/brinde não pode entrar no faturamento | Lucro negativo nessas linhas |
| O que significam os locais "sumiu", "novo" e nome de pessoa? | Perda/roubo, entrada recente ou consignação mudam o saldo e o tipo de movimentação | Coluna LOCAL DO ESTOQUE |
| Por que há peças com cliente e sem valor de venda (16 casos)? | Venda a receber? Reserva? | Coluna CLIENTE |
| A aba RAMON é redundante com FOLHEADOS? | Evitar contar a mesma peça duas vezes | 274/275 códigos repetidos, com o mesmo custo |
| O CLS é o catálogo próprio de ouro ou um catálogo de fornecedor? Existe estoque de ouro com saldos? | Define se o CLS alimenta a dimensão de produtos real | Arquivo de 2019 sem quantidades nem R$ |
| O que é o INDICE e qual constante o relaciona ao custo? | Necessário para aplicar a fórmula com dados reais | Razões variáveis (200, 292, 167…) |
| Qual é a unidade do PESO? | Não misturar unidades | Valores de 0,08 a 51,5 |
| O prefixo numérico do código define o tipo de peça? | Taxonomia (tipo × material) | Correlação observada, não confirmada |
| Existem outras fontes (vendas, compras, relógios, platina)? | Escopo da integração | Não encontradas em `data/raw/` |
| Qual política de valorização de estoque será adotada? | Margem, estoque valorizado e giro | Fora da fase 1 |

## Requisitos do futuro sistema operacional

Necessários para que as análises demonstradas funcionem com dados reais:
- identificador único de venda, agrupando todos os itens;
- data de aquisição e custo efetivamente pago de cada entrada;
- quantidade recebida;
- motivo explícito de cada saída não comercial (presente, roubo, perda, ajuste);
- unidade de referência do preço do ouro;
- cliente associado à venda, se essa funcionalidade vier a ser implementada.
