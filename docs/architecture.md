# Arquitetura

O projeto tem duas partes separadas:

- **Solução real** (fase 2): aplicação web, banco operacional, ETL, Data Warehouse e painéis, hospedados no Microsoft Azure, com os dados reais da joalheria. Descrita a seguir.
- **Ambiente demonstrativo** (fase 1, histórico): DW com dados sintéticos e relatório Power BI, executados localmente em 2026-10-31 e 2026-11-01. Descrito na segunda metade deste documento e mantido sem alteração.

## Solução real (fase 2)

### Fluxo

```
Planilhas da joalheria ──(importação única, npm run importar:planilhas)──► nobreza_app
Navegador ──► aplicação web (Next.js) ──► nobreza_app (esquema app)
nobreza_app ──ETL (scripts/run_etl_app.ps1, papel nobreza_leitura_dw)──► dw_joalheria
dw_joalheria: staging ─► dw (estrela) ─► bi (12 views)      audit: execuções, etapas, rejeições, verificações
bi ──papel bi_leitura──► tela Relatórios do sistema (7 seções, com filtros)
bi ──papel bi_leitura──► Grafana Cloud (as mesmas 7 seções: painel público e painel completo com login)
nobreza_app ──► tela Indicadores do sistema (3 indicadores, com escolha do formato)
```

### Hospedagem (Microsoft Azure, região Brasil Sul)

| Recurso | Configuração | Conteúdo |
|---|---|---|
| Azure App Service | Linux, Node 22, plano B1 | Aplicação web Next.js, em `https://nobreza-joias-ctckede5c0fsf5fu.brazilsouth-01.azurewebsites.net` |
| Azure Database for PostgreSQL, servidor flexível | `nobreza-dw.postgres.database.azure.com`, PostgreSQL 18.6, camada B1ms, backup automático com retenção de 7 dias | Bancos `nobreza_app` (operacional) e `dw_joalheria` (Data Warehouse) |
| Grafana Cloud (plano gratuito, fora do Azure) | Fonte de dados PostgreSQL com SSL `require` | Painel público por link e painel completo com login de Viewer |

**Firewall do servidor de banco:** só aceita conexões dos serviços do Azure (a aplicação), da máquina de administração (migrations e ETL) e dos endereços de saída do Grafana Cloud. As conexões usam SSL.

### Papéis do banco

| Banco | Papel | Uso | Privilégios |
|---|---|---|---|
| `nobreza_app` | `nobreza_migracao` | Migrations da aplicação | Dono do esquema `app` |
| `nobreza_app` | `nobreza_aplicacao` | Aplicação em execução | Sem escrita direta em vendas, itens, movimentações e saldos: só pelas funções de estoque |
| `nobreza_app` | `nobreza_leitura_dw` | Origem do ETL | Só leitura; não enxerga `consignado_com`, `local_original` nem as tabelas de usuário, sessão e auditoria (nenhum nome de pessoa sai do banco operacional) |
| `dw_joalheria` | `dw_carga` | Dono dos esquemas reais; migrations e carga do ETL | Escrita em `staging`, `dw`, `bi` e `audit` |
| `dw_joalheria` | `bi_leitura` | Tela Relatórios e Grafana | Só SELECT nas views do esquema `bi` |

As senhas ficam fora do repositório: nos arquivos locais `.env.dw_azure` (ETL) e `.env.app_azure` (aplicação), ambos ignorados pelo Git, e nas configurações do App Service.

### Atualização dos dados

- A aplicação grava no banco operacional no ato de cada operação.
- O DW é atualizado pela execução do ETL, por recarga completa, a partir da máquina de administração: `$env:DW_ARQUIVO_ENV='<caminho do .env.dw_azure>'; scripts\run_etl_app.ps1`. Cada execução fica registrada em `audit` (ver `docs/etl_runbook.md`).
- A tela Relatórios e o Grafana leem o DW no momento da consulta e mostram o estado da última carga, com a data de referência no cabeçalho. Dados novos da aplicação só aparecem nos painéis depois do ETL.
- A tela Indicadores lê o banco operacional e já mostra as operações registradas.

### Ferramenta de análise: Power BI → Grafana e gráficos no sistema

O relatório da solução real foi construído primeiro no Power BI (`powerbi/relatorio_joalheria.*`), sobre o esquema `bi`. Ele foi descartado como entrega, por três motivos:

1. **Licença:** publicar e compartilhar um relatório no serviço do Power BI exige licença Pro ou Premium por usuário (PPU).
2. **Bloqueio institucional:** o "Publicar na Web" (link público, que dispensaria licença para quem vê) está desativado pelo administrador do locatário da universidade.
3. **Custo para o cliente:** manter o relatório exigiria assinaturas pagas pela joalheria.

Substituto:

- **Grafana Cloud, plano gratuito:** lê o DW diretamente, tem painel público por link (sem login) e até 3 usuários ativos com login, o que atende ao proprietário e ao funcionário. Não aceita ser exibido em quadro (`frame-ancestors 'none'`), por isso o sistema abre o painel por um botão.
- **Gráficos na tela Relatórios do sistema:** as mesmas 7 seções, lidas do DW pelo papel `bi_leitura` (variável `DW_DATABASE_URL`), com filtros de Material, Tipo de peça e Ano, sem depender de serviço externo.

O relatório Power BI real fica no repositório como histórico e não é mantido. O relatório demonstrativo da fase 1 continua como estava.

### Decisões de arquitetura (solução real)

- **Banco operacional separado do DW:** nenhum código da aplicação grava em `dw_joalheria`; a tela Relatórios só lê as views `bi`, e a carga do DW é feita só pelo ETL.
- **Esquemas reais separados da demonstração:** `staging`, `dw`, `bi` e `audit` não leem nem alteram os esquemas `*_demo`.
- **ETL em SQL com PowerShell + `psql`**, sem ferramenta externa de orquestração: não há necessidade técnica demonstrada.
- **Recarga completa** a cada execução em `staging`, `dw` e `bi`; `audit` só recebe inserções.
- **Mesmo modelo dimensional da fase 1** e as mesmas views de consumo, o que permitiu reaproveitar consultas e regras.

---

# Ambiente demonstrativo (fase 1, histórico)

**Status:** aprovada em 2026-10-31; **implementada e executada** em 2026-10-31 e 2026-11-01 (banco `dw_joalheria` local, 21 migrations, ETL com 24/24 verificações aprovadas, relatório Power BI). O relatório demonstrativo tem 7 páginas funcionais e 61 medidas.

## Fluxo lógico — fase 1 (dados sintéticos)

```
config_demo   parâmetros da simulação, semente, distribuições, fatores sintéticos
     │
     ▼  gerador determinístico em PL/pgSQL
staging_demo  registros sintéticos brutos por execução
     │  validação SQL ──► audit_demo.rejeicao
     ▼  transformação e carga SQL
dw_demo       dimensões, fatos e parametro_preco_ouro (esquema estrela)
     │
     ▼
bi_demo       views de consumo ──► Power BI (modo Import)

audit_demo    execuções, etapas, contagens, rejeições e resultados de validação (somente demo)
```

## Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Configuração | `config_demo` (tabelas) | Semente, período, volumes, distribuições, fatores sazonais e afinidades (sintéticos) |
| Gerador | PL/pgSQL | Gera catálogo, série sintética do preço do ouro e simulação diária de estoque, compras e vendas, de forma determinística |
| Staging | `staging_demo` | Recebe os registros gerados, com `id_execucao` |
| Validação | SQL | Regras de domínio, material, preço e referências; rejeições registradas, nunca descartadas em silêncio |
| DW | `dw_demo` | Dimensões, fatos e parâmetro de preço do ouro versionado |
| Consumo | `bi_demo` | Views estáveis para o Power BI, incluindo associação de pares e informação do ambiente |
| Auditoria | `audit_demo` | Execução, etapas, contagens, rejeições, validações e correções de preço |
| Orquestração | PowerShell + `psql` | `scripts/*.ps1`; leem `PG*` e `PG_BIN` do `.env` local |
| Segurança de leitura | Perfil `bi_leitura` (`db/seguranca/bi_leitura.sql`) | CONNECT, USAGE em `bi_demo` e SELECT nas views; nenhuma escrita |
| Apresentação | Power BI Desktop (Import), formato PBIP | Modelo semântico (12 views, 50 medidas, 10 relacionamentos) e 6 páginas; ver `powerbi/data_model.md` |
| Conferência | PowerShell + `psql` (`tests/reconciliacao/`) | Recalcula no SQL os indicadores do relatório, somente leitura |

## Decisões de arquitetura

- **PostgreSQL 18.6 local**, já instalado. Um único banco (`PGDATABASE`), com separação por esquemas.
- **Gerador em SQL/PL/pgSQL:** geração, validação e transformação ficam dentro do PostgreSQL, num único lugar auditável e reproduzível. O Python fica reservado para a importação de XLSX na fase 2.
- **Determinismo:** uma função própria baseada em `md5(semente, fluxo, n)` substitui `random()`, cujo algoritmo pode mudar entre versões.
- **Sem ferramentas externas** de ETL ou orquestração (Airflow, dbt, Docker), por não haver necessidade técnica demonstrada.
- **Power BI em modo Import:** o volume é pequeno e permite validação reproduzível contra o SQL.
- **Esquema estrela:** fatos separados por processo e dimensões conformadas (`dim_produto`, `dim_data`). Não há relação entre fatos no modelo semântico.

## Separação entre demo e ambiente real

| Aspecto | Fase 1 (demo) | Fase 2 (real) |
|---|---|---|
| Esquemas | `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo` | `staging`, `dw`, `bi`, `audit`, criados em 2026-11-21 |
| Origem | gerador sintético | banco operacional da aplicação (`nobreza_app`), que recebeu as planilhas por importação única |
| Marcação | `origem_dado = 'SINTETICO_DEMO'` | `origem_dado` = `PLANILHA` (importado) ou `APLICACAO` (registrado no sistema) |
| Apresentação | Power BI com conexão fixa em `localhost:5432`, banco `dw_joalheria`, esquema `bi_demo`; aviso fixo em todas as páginas | tela Relatórios do sistema e Grafana Cloud, sobre o esquema `bi` no Azure |

As views reais futuras devem manter os mesmos nomes de colunas das views demo. **Implementado:** as 12 consultas M usam valores fixos (`PostgreSQL.Database("localhost:5432", "dw_joalheria")` e o esquema `bi_demo`), sem parâmetro. **Melhoria futura (não implementada):** parametrizar servidor, banco e esquema para trocar de ambiente sem editar as consultas. Dados demo e reais nunca são unidos.

Em 2026-11-01 os esquemas reais ainda não existiam; foram criados em 2026-11-21 para a solução real.

## Usuários do banco

| Perfil | Uso | Situação |
|---|---|---|
| `postgres` (superusuário) | Migrations, ETL, testes e conferências; é o usuário do `.env` | Aceitável apenas no ambiente demonstrativo local; não é configuração de produção |
| `bi_leitura` | Leitura das views `bi_demo` pelo Power BI | Criado e auditado por metadados em 2026-11-01: SELECT nas 12 views; nenhum INSERT, UPDATE, DELETE, TRUNCATE ou CREATE; não é superusuário nem membro de outro papel; sem USAGE em `dw_demo`, `staging_demo`, `config_demo` e `audit_demo`. Herda de PUBLIC o padrão do PostgreSQL: TEMPORARY no banco e EXECUTE nas funções, que ficam inacessíveis por falta de USAGE nos esquemas. Qual usuário está gravado nas credenciais do Power BI Desktop: **pendente de confirmação** |

## Fora do escopo

Na fase 1, o sistema web transacional (entrou no escopo em 2026-11-10). Nas duas fases: pagamentos, financeiro, fornecedores, logística, frete, e-commerce, clientes, previsão de demanda, margem bruta, estoque valorizado e giro por custo.
