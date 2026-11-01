# Instruções do projeto para Claude Code

## Missão

Implementar uma solução acadêmica de Business Intelligence para uma joalheria, com PostgreSQL, Data Warehouse relacional dimensional, ETL, testes e Power BI. O foco obrigatório é fornecer dados confiáveis para relatórios de negócio no Power BI.

## Idioma

Toda comunicação, documentação, comentários e instruções devem estar em português brasileiro.

## Estado conhecido (não presumir além disto)

- Ambiente (informado pelo usuário em 2026-10-31 e conferido): Windows 11 Pro; Git/GitHub configurados; Python 3.14.10; **PostgreSQL 18.6 instalado**, com o serviço `postgresql-x64-18` em execução. Docker não será usado. Power BI Desktop ainda não está instalado; **a instalação será feita pelo usuário**.
- O `psql` pode não estar no PATH da sessão; os scripts devem aceitar `PG_BIN` (por exemplo, `C:\Program Files\PostgreSQL\18\bin`). Não instalar nem reinstalar Python ou PostgreSQL.
- As fontes reais em `data/raw/` foram inspecionadas (ver `docs/source_inventory.md`): `Tabela de preços de Folheados e prata.xlsx` (abas FOLHEADOS, RAMON - PEÇAS e CATEGORIAS) e `CLS Tabela por indice Excel (…).xlsx`. Não existe arquivo separado de compras nem de vendas: esses dados aparecem como colunas da planilha de estoque.
- A fonte real de vendas não possui identificador de transação.

Não transforme a existência declarada de uma fonte em confirmação dos seus campos. Diferencie sempre fatos observados, declarações do usuário, hipóteses e decisões pendentes.

## Fase 1 — ambiente demonstrativo com dados sintéticos (decisão do usuário, 2026-10-31)

A primeira entrega usa **somente dados sintéticos**, gerados de forma determinística dentro do PostgreSQL. O plano aprovado está resumido em `docs/architecture.md` e `docs/demo_data_specification.md`.

- Esquemas exclusivos da demo: `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo`. Nenhum esquema é compartilhado com o ambiente real futuro. Os esquemas reais (`staging`, `dw`, `bi`, `audit`) **não** devem ser criados nesta fase.
- Toda linha sintética recebe `origem_dado = 'SINTETICO_DEMO'`. Os códigos seguem o padrão `DEMO-…`.
- **Exceção às regras 3 e 5**, válida apenas nos esquemas `*_demo`:
  - dados sintéticos são permitidos para viabilizar a demonstração;
  - identificadores artificiais de venda permitem ticket médio e associação **somente** sobre os dados sintéticos.
- **Proibido nesta fase:** importar ou copiar registros, códigos, descrições, preços, quantidades ou clientes das planilhas reais; gerar dados pessoais ou dimensão de clientes.
- Todo painel do Power BI deve exibir: "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA."
- Padrões sintéticos (sazonalidade, afinidades, gatilho de reposição, descontos) devem ser documentados como inseridos intencionalmente. Não são conclusões sobre a empresa.
- Margem bruta, estoque valorizado e giro por custo ficam fora da fase 1.
- Operações destrutivas, inclusive `scripts/reset_demo.ps1`, exigem confirmação explícita do usuário a cada execução.

## Regras inegociáveis

1. Não inventar dados, campos, fontes, histórico, volume, identificadores, categorias, unidades de medida, preços ou regras comerciais.
2. Inspecionar arquivos reais antes de fechar a granularidade, o modelo dimensional ou as fórmulas dos indicadores.
3. Não preencher lacunas com dados sintéticos em tabelas de produção. Dados sintéticos só podem existir em testes isolados e claramente identificados.
4. Não tratar toda saída de estoque como venda. Perdas e presentes reduzem estoque, mas não geram faturamento.
5. Não calcular ticket médio por transação nem associação de itens comprados em conjunto sem um identificador confiável de transação ou evidência equivalente de agrupamento.
6. Não calcular margem bruta sem política de valorização de estoque e dados suficientes para associar custo e venda.
7. Não calcular giro tradicional sem definir a fórmula e obter os dados requeridos, como estoque médio valorizado e custo das mercadorias vendidas quando aplicável.
8. Não somar preços unitários. Confirmar se o preço da fonte é unitário ou valor total do item.
9. Não misturar unidades (por exemplo, peças e peso) na mesma agregação.
10. Não reconstruir histórico anterior à primeira observação de estoque se não houver registros históricos. Snapshots futuros criam histórico somente a partir da primeira coleta real.
11. Evitar duplicidade entre fatos de vendas e fatos de movimentação de estoque. Respeitar a granularidade de cada fato.
12. Não implementar sistema web transacional, pagamentos, fluxo financeiro completo, fornecedores, logística, frete ou e-commerce no escopo inicial.
13. Não implementar previsão de demanda como se fosse requisito confirmado. Priorizar análise descritiva e comparação de períodos, condicionadas ao histórico.
14. Não instalar programas globalmente, alterar configurações do sistema, apagar dados ou executar operações destrutivas sem autorização explícita.
15. Não executar `git commit` ou `git push` sem solicitação explícita do usuário.
16. Nunca usar `--dangerously-skip-permissions` ou equivalente para contornar confirmações de segurança.

## Arquitetura preferencial

**Fontes → staging → ETL → Data Warehouse PostgreSQL → Power BI.**

- PostgreSQL é obrigatório para o Data Warehouse.
- Priorizar SQL e recursos nativos do PostgreSQL para transformação e carga.
- Usar Python principalmente para extrair XLSX e carregar staging quando necessário.
- Não adicionar Airflow, dbt ou outra ferramenta de ETL sem uma necessidade técnica demonstrada e aprovação do usuário.
- Avaliar esquemas `staging`, `dw` e `audit`; documentar a decisão.
- Power BI deve consumir dados preparados no Data Warehouse, não substituir o ETL.
- Considerar inicialmente Power BI em modo Import, salvo justificativa concreta para outra opção.
- Docker não é requisito. Preparar a instalação local de PostgreSQL no Windows se esse for o sistema detectado.

## Modelagem dimensional

Avaliar, sem implementar automaticamente:

- `dim_produto`
- `dim_data`
- `dim_tipo_movimentacao`, se houver eventos de movimentação identificáveis
- `fato_snapshot_estoque`, se houver saldos observáveis em datas de referência
- `fato_movimentacao_estoque`, somente se houver eventos individuais
- `fato_compra_item`, conforme a granularidade real da fonte de compras
- `fato_venda_item`, conforme a granularidade real da fonte de vendas

Para cada fato, documentar o significado de uma linha (grão), medidas, dimensões, chaves, origem e limitações. Não criar fato redundante por seguir um desenho anterior. Não criar uma chave técnica e alegar que ela é o identificador comercial da transação.

Categoria, subcategoria, material e tipo de peça não são sinônimos. Confirmar a taxonomia usada pela empresa antes de modelar a hierarquia.

## ETL e qualidade

- Preservar fontes originais e nunca sobrescrevê-las.
- Registrar lote/carga, horário, quantidade lida, carregada e rejeitada e motivos das rejeições.
- Não descartar dados inválidos silenciosamente.
- Tornar cargas idempotentes quando houver chave de negócio ou critério confiável para isso; documentar limitações se não houver.
- Validar tipos, datas, quantidades, valores e referências dimensionais.
- Manter scripts SQL versionados e testes reproduzíveis.
- Não usar hash de linha como prova de identidade de negócio.

## Privacidade e Git

- Não imprimir dados pessoais ou comerciais desnecessários em logs, documentação ou respostas.
- Não versionar fontes em `data/raw/`, arquivos derivados em `data/processed/`, documentos privados em `docs/referencia/`, `.env`, credenciais, backups ou dumps locais.
- Nunca colocar senhas, tokens ou dados reais no código ou no `.env.example`.
- Antes de sugerir um commit, revisar `git status` e arquivos staged.
- Restringir operações ao diretório do repositório, salvo autorização explícita.

## Organização esperada

- `db/migrations/`: criação/evolução de estruturas PostgreSQL.
- `db/views/`: visões analíticas.
- `etl/sql/`: transformações e cargas SQL.
- `etl/python/`: extração auxiliar, especialmente XLSX.
- `scripts/`: comandos de execução e validação.
- `tests/`: testes e fixtures sintéticas isoladas.
- `powerbi/`: DAX, modelo semântico, instruções e plano de relatórios.
- `docs/`: inventário, arquitetura, decisões, dicionário, ETL, indicadores e pendências.

Adapte a estrutura ao repositório existente e preserve arquivos úteis.

## Fluxo de trabalho obrigatório

1. Ao iniciar, execute `pwd`, `git status --short --branch` e liste os arquivos do projeto.
2. Leia este `CLAUDE.md`, o `README.md` e a documentação existente.
3. Inspecione fontes reais em `data/raw/`, sem alterar os arquivos.
4. Atualize `docs/source_inventory.md` e `docs/pending_questions.md` com evidências observadas.
5. Apresente plano curto antes de mudanças estruturais.
6. Separe decisões já sustentadas de hipóteses e decisões pendentes.
7. Implemente apenas componentes que não dependam de decisões ainda não respondidas.
8. Execute testes após cada etapa relevante e informe resultados reais.
9. Mantenha documentação, SQL, testes e medidas DAX consistentes.
10. Ao encerrar, informe arquivos alterados, decisões, comandos, testes, limitações e perguntas que bloqueiam a próxima etapa.

Não faça perguntas que possam ser respondidas inspecionando os arquivos. Quando uma informação indispensável não estiver nos arquivos, faça perguntas objetivas e explique o impacto da resposta.

## Critérios de conclusão

A solução só pode ser considerada concluída quando a criação do banco for reproduzível, as fontes reais forem carregadas, o ETL for auditável, as granularidades forem respeitadas, os indicadores tiverem fórmula/unidade/período/limitações documentados, o Power BI puder consumir o DW e os testes tiverem sido executados ou suas limitações claramente registradas.
