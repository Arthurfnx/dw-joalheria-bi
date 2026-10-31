# Perguntas e decisões pendentes

Atualizar esta lista após inspecionar as fontes. Não perguntar ao usuário o que puder ser descoberto nos arquivos.

| Pergunta | Por que importa | Como investigar | Status |
|---|---|---|---|
| Quais arquivos e abas contêm produtos/estoque, compras e vendas? | Define a extração | Inspecionar arquivos locais | Pendente |
| Qual é o período coberto por cada fonte? | Define análises temporais possíveis | Examinar campos de data e registros | Pendente |
| O que representa cada linha da fonte de compras? | Define a granularidade da fato de compras | Inspecionar layout e confirmar com parceiro | Pendente |
| O que representa cada linha da fonte de vendas? | Define a granularidade da fato de vendas | Inspecionar layout e confirmar com parceiro | Pendente |
| Há algum atributo que permita relacionar itens da mesma venda? | Sem isso, ticket por venda e cesta de produtos não são calculáveis com segurança | Inspecionar colunas e confirmar com parceiro | Pendente; usuário informou ausência de ID de transação |
| Quantidades representam peças, peso ou outra unidade? | Evita agregações incompatíveis | Inspecionar cabeçalhos e confirmar com parceiro | Pendente |
| Preço de venda é unitário ou total do item? | Define cálculo de faturamento | Inspecionar fonte e confirmar | Pendente |
| Custo de compra é unitário ou total do item? | Define análise de custos | Inspecionar fonte e confirmar | Pendente |
| Categoria, subcategoria, material e tipo de peça são conceitos distintos? | Define hierarquia de produto | Inspecionar valores e validar com parceiro | Pendente |
| Há identificador estável de produto nas três fontes? | Permite relacionar compras/vendas a produtos | Inspecionar chaves e valores | Pendente |
| Há histórico de saldos ou movimentações além do saldo atual? | Determina se há evolução histórica | Inspecionar datas e registros | Pendente |
| Qual regra de valorização de estoque será adotada? | Necessária para margem/giro baseado em custo | Decisão com parceiro/orientador | Pendente |

## Ambiente

- PostgreSQL: não instalado/configurado no ambiente, conforme informado.
- Power BI Desktop: não instalado, conforme informado.
- Docker: não instalado; não é requisito da primeira versão.
