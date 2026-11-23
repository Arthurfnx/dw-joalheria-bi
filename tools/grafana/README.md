# Painel de indicadores no Grafana

Painel "Nobreza Jóias — Indicadores", lido pelo Grafana diretamente do Data Warehouse PostgreSQL
(`dw_joalheria`, esquema `bi`). Ferramenta gratuita (Grafana Cloud, plano Free), com endereço público
por link externo.

| Arquivo | Conteúdo |
|---|---|
| `painel_nobreza.json` | Painel público (link externo, sem filtros), pronto para "Import dashboard" |
| `painel_nobreza_completo.json` | Painel completo, para uso com login, com filtros Material, Tipo de peça e Ano |
| `consultas/*.sql` | Consultas do painel público, com indicador, fórmula e unidade no cabeçalho |
| `consultas_completo/*.sql` | As mesmas consultas com os filtros `$material`, `$tipo_peca` e `$ano` |
| `gerar_painel.mjs` | Regera os dois JSON depois de alterar uma consulta: `node tools/grafana/gerar_painel.mjs` |

## Conteúdo do painel

| Seção | Painéis | Consultas |
|---|---|---|
| Cabeçalho | Sobre o painel; data de referência e status da última carga | `00` |
| 1. Vendas por período | Cartões de totais; receita (R$) por mês; peças por mês | `01`–`03` |
| 2. Tipos vendidos | Peças e receita por tipo de peça; vendas por material | `04`–`06` |
| 3. Taxa de venda e tempo até a venda | Por tipo de peça e por material | `07`, `08` |
| 4. Produtos parados | Material › Tipo de peça › Produto, mais antigos primeiro; peças sem data de aquisição | `09`, `10` |
| 5. Tipo que mais fica parado | Mediana, média e % acima de 180 dias por tipo | `11` |
| 6. Sazonalidade | Peças e receita por mês do ano | `12`, `13` |
| 7. Reposição | Cobertura em meses por material e tipo — proposta (a confirmar com o proprietário) | `14` |

Regras aplicadas em todos os painéis:

- Receita = `valor_faturado`: vendas simbólicas (R$ 0,01) e sem valor ficam fora da receita, mas contam
  como peças vendidas. Vendas canceladas já estão fora do DW.
- R$ e peças nunca dividem o mesmo eixo. Preço unitário não é somado.
- "Hoje" = data de referência da última carga do DW (dia do último retrato do estoque).
- Peças sem data de aquisição não recebem data estimada: aparecem em painel próprio.
- "Taxa de venda" e "tempo até a venda" não são o giro de estoque tradicional, que exige custo das
  vendas e estoque médio valorizado.
- O painel público não tem variáveis, porque o link público do Grafana não as aceita (o completo, com
  login, tem filtros; ver seção 5). Nenhuma consulta usa o seletor de período.
- Nenhuma view do esquema `bi` tem nome de pessoa.

## 1. Pré-requisitos

- Conta no Grafana Cloud (plano Free) e uma stack criada.
- O firewall do servidor PostgreSQL no Azure precisa aceitar as conexões do Grafana Cloud: inclua nas
  regras de rede do servidor os endereços de saída da sua stack, publicados pela Grafana Labs
  (documentação "Grafana Cloud allow list", seção Hosted Grafana).
- Senha do usuário `bi_leitura`, com o responsável pelo banco. Ela não está neste repositório.

## 2. Criar a fonte de dados

No Grafana: **Connections › Data sources › Add new data source › PostgreSQL**.

| Campo | Valor |
|---|---|
| Name | `Nobreza DW` (qualquer nome) |
| Host URL | `nobreza-dw.postgres.database.azure.com:5432` |
| Database name | `dw_joalheria` |
| Username | `bi_leitura` |
| Password | senha do `bi_leitura` |
| TLS/SSL Mode | `require` |
| Version | a mais alta oferecida (o servidor é PostgreSQL 18) |
| TimescaleDB | desligado |

Clique em **Save & test**: deve aparecer "Database Connection OK". O usuário `bi_leitura` só lê as views
do esquema `bi`.

## 3. Importar o painel

1. **Dashboards › New › Import**.
2. **Upload dashboard JSON file** e escolha `tools/grafana/painel_nobreza.json`.
3. Em **Nobreza DW (PostgreSQL)**, selecione a fonte criada no passo 2.
4. **Import**. O painel abre com as 7 seções preenchidas.

Para reimportar depois de uma alteração, use o mesmo arquivo e confirme a substituição (o `uid` é fixo:
`nobreza-indicadores`).

## 4. Ativar o link público

1. Abra o painel e clique em **Share › Share externally** (em versões anteriores: **Share › Public
   dashboard**).
2. Em acesso, escolha **Anyone with the link** e confirme os avisos.
3. Clique em **Copy external link**. Esse endereço abre o painel sem login.

Para revogar, volte em **Share externally** e pause ou exclua o compartilhamento.

## 5. Painel completo, com filtros (uso com login)

O painel "Nobreza Jóias — Indicadores (completo)" tem as mesmas 7 seções, com três filtros no topo, todos
de seleção múltipla e com a opção "Todos" (o Grafana em inglês mostra "All"):

| Filtro | Valores | Onde vale |
|---|---|---|
| Material | materiais do cadastro | todos os painéis |
| Tipo de peça | tipos dos materiais escolhidos | todos os painéis |
| Ano | anos com venda | vendas, tipos vendidos, taxa e tempo até a venda (só nas vendas) e sazonalidade |

Em produtos parados, tipo mais parado e reposição, o ano não se aplica: são o estoque de hoje, e a
reposição usa sempre os últimos 12 meses. A descrição de cada painel (ícone ⓘ) diz quais filtros valem.
Com "Todos" em tudo, os números são os mesmos do painel público.

Importar:

1. **Dashboards › New › Import** e envie `tools/grafana/painel_nobreza_completo.json`.
2. Em **Nobreza DW (PostgreSQL)**, escolha a mesma fonte do passo 2 e clique em **Import**.
3. Não ative o link público neste painel: o link externo não aceita filtros. Ele é para quem entra
   com conta.

## 6. Convidar o proprietário e o funcionário

1. **Administration › Users and access › Users › Invite** (ou **Org users › Invite**).
2. Informe o e-mail da pessoa, escolha o papel **Viewer** e envie o convite.
3. A pessoa aceita pelo e-mail, cria a senha e encontra os painéis em **Dashboards**.

O papel Viewer só vê os painéis: não altera painéis nem fontes de dados. O plano gratuito do Grafana Cloud
tem limite de 3 usuários ativos por mês, contando o administrador.

## Limitações

- Cerca de 110 vendas em dois anos de histórico: sazonalidade e tempo até a venda são indicativos.
- O tempo até a venda só usa vendas cujo produto tem data de aquisição (a coluna "Amostra" mostra
  quantas). Vendas com data de aquisição posterior à data da venda ficam fora da amostra.
- Todo o ouro e boa parte do folheado não têm data de aquisição: ficam fora dos dias parado.
- A regra de reposição (cobertura abaixo de 3 meses) é uma proposta, a confirmar com o proprietário.
- Os números em gráficos seguem o idioma do navegador (em português, vírgula decimal); cartões e tabelas
  já vêm formatados em R$ com vírgula.
- O painel mostra o estado da última carga do DW: dados novos da aplicação só aparecem depois de rodar o
  ETL.
