# Nobreza Jóias — aplicação web

Aplicação de estoque, vendas e compras da Nobreza Jóias. Next.js (App Router) + React + TypeScript, com PostgreSQL 18 local. Contém a fundação (T01: login, perfis, usuários, cadastros de domínio, auditoria, relatórios do Power BI) e o estoque (T02: importação das planilhas, produtos, saídas e ajustes, preço do ouro).

Especificação: `docs/app_web/02_especificacao.md`.

## Requisitos

- Node.js 22 (22.12 ou mais recente)
- PostgreSQL 18 local (serviço `postgresql-x64-18`). Se o `psql` não estiver no PATH, defina `PG_BIN` com a pasta `bin` da instalação, por exemplo `C:\Program Files\PostgreSQL\18\bin`.

## 1. Criar os bancos e os papéis (uma vez)

O script `db/bootstrap/01_criar_bancos_e_papeis.sql` cria os bancos `nobreza_app` e `nobreza_app_teste` e os papéis `nobreza_migracao` (dono do esquema, aplica as migrations) e `nobreza_aplicacao` (conexão da aplicação, com privilégio mínimo). Ele é executado **pelo administrador do PostgreSQL**; a aplicação nunca usa a conta `postgres`. O script não apaga nada e para com erro se algum objeto já existir.

Na pasta `web/`, no PowerShell, escolha duas senhas diferentes:

```powershell
& "$env:PG_BIN\psql.exe" -U postgres -d postgres -v senha_migracao='SENHA_DA_MIGRACAO' -v senha_aplicacao='SENHA_DA_APLICACAO' -f db/bootstrap/01_criar_bancos_e_papeis.sql
```

Depois, o script `db/bootstrap/02_criar_papel_leitura_dw.sql` cria o papel `nobreza_leitura_dw`, usado pelo ETL do Data Warehouse: só leitura, sem as colunas com nomes de pessoas (`consignado_com`, `local_original`) e sem as tabelas de usuário, sessão e auditoria. Os privilégios vêm da migration 0008, que exige o papel: **execute este script antes de `npm run db:migrar`**.

```powershell
& "$env:PG_BIN\psql.exe" -U postgres -d postgres -v senha_leitura_dw='SENHA_DA_LEITURA' -f db/bootstrap/02_criar_papel_leitura_dw.sql
```

## 2. Configurar o ambiente

Copie `.env.example` para `.env` (o `.env` não é versionado) e preencha:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://nobreza_aplicacao:SENHA_DA_APLICACAO@localhost:5432/nobreza_app` |
| `DATABASE_URL_MIGRACAO` | `postgresql://nobreza_migracao:SENHA_DA_MIGRACAO@localhost:5432/nobreza_app` |
| `DATABASE_URL_TESTE` | `postgresql://nobreza_aplicacao:SENHA_DA_APLICACAO@localhost:5432/nobreza_app_teste` |
| `DATABASE_URL_TESTE_MIGRACAO` | `postgresql://nobreza_migracao:SENHA_DA_MIGRACAO@localhost:5432/nobreza_app_teste` |
| `DATABASE_URL_LEITURA_DW` | `postgresql://nobreza_leitura_dw:SENHA_DA_LEITURA@localhost:5432/nobreza_app`. Os testes usam o mesmo papel em `nobreza_app_teste` |
| `POWERBI_URL_RELATORIO` | Endereço do "Publicar na Web" do relatório; precisa começar por `https://app.powerbi.com/`. Vazio ou fora desse padrão, a tela Relatórios informa que não está configurado |

Senhas com caracteres especiais (`@`, `:`, `/`, `#`, `%`) precisam ser codificadas na URL, por exemplo `@` vira `%40`.

## 3. Instalar, migrar e criar o administrador

```powershell
npm install
npm run db:migrar
npm run usuario:criar-admin
```

- `db:migrar` aplica, em ordem e cada uma na sua transação, as migrations pendentes de `db/migrations/` em `nobreza_app`, e registra nome, SHA-256 e data em `migracao.historico`. Executado de novo, não faz nada. Se um arquivo já aplicado tiver mudado (ou sumido), a execução é recusada: migration aplicada não se edita, corrige-se com uma nova.
- `usuario:criar-admin` pede nome, login e senha no terminal (a senha sem eco, duas vezes). Só funciona enquanto não houver administrador ativo; os demais usuários são criados pela tela **Usuários**.

## 4. Importar as planilhas (uma única vez)

```powershell
npm run importar:planilhas -- --folheados "<caminho da planilha de folheados e prata>" --ouro "<caminho da planilha CLS>" --login <login do administrador>
```

- Os arquivos são abertos somente para leitura. A coluna de cliente nunca é lida.
- Só roda num banco sem produtos, e tudo entra numa única transação: um erro no meio não deixa nada gravado.
- O terminal mostra só contagens por aba e motivos agrupados, além da conferência (lidas = importadas + rejeitadas; soma dos saldos = peças em estoque e consignadas).
- As linhas rejeitadas ou a revisar ficam na tela **Importação**, com aba, linha e código.
- Grafias de categoria aceitas: `src/servidor/importacao/categorias.ts`. Palavra fora da tabela vira "A classificar".

## 5. Executar

```powershell
npm run dev
```

Abra `http://localhost:3000`. Para produção local: `npm run build` e `npm run start`.

**Pelo celular, na mesma rede:** inicie com o endereço do computador na rede, por exemplo `npx next dev --hostname 192.168.0.10`, e abra `http://192.168.0.10:3000` no celular. Em `npm run start` fora de `localhost` o cookie de sessão é `Secure` e exige HTTPS.

## 6. Testar

```powershell
npm run test
```

- Os testes unitários (`testes/unidade/`) não usam banco.
- Os testes de integração (`testes/integracao/`) usam `nobreza_app_teste`: apagam e recriam os esquemas `app` e `migracao` e aplicam as migrations com `DATABASE_URL_TESTE_MIGRACAO`, e exercitam a aplicação com `DATABASE_URL_TESTE` (papel `nobreza_aplicacao`), para que os privilégios também sejam testados. A rotina recusa qualquer banco cujo nome não termine em `_teste`, conferido na cadeia de conexão e no servidor.

Outras verificações: `npm run typecheck`, `npm run lint`, `npm run build`.

## Estrutura

```
web/
  db/bootstrap/        script de criação dos bancos e papéis (executado pelo administrador do PostgreSQL)
  db/migrations/       migrations SQL numeradas
  scripts/             comandos de linha (db:migrar, usuario:criar-admin, importar:planilhas)
  src/servidor/        camada de servidor: acesso a dados, regras, permissões (sem React)
  src/web/             ponte entre o Next.js (cookies, cabeçalhos) e a camada de servidor
  src/app/             telas e ações de servidor do Next.js
  src/componentes/     componentes de interface (estilo shadcn/ui, só com Tailwind)
  testes/              testes unitários e de integração (Vitest)
```

As telas e as ações de servidor apenas chamam `src/servidor/`; é lá que a entrada é validada e a permissão do perfil é verificada, em toda operação.

## Perfis nesta etapa

| Tela | Administrador | Vendedor |
|---|---|---|
| Início, trocar a própria senha, sair | Sim | Sim |
| Produtos: consultar, ver saldo e histórico | Sim | Sim, sem valor de aquisição, custo e consignado com |
| Produtos: cadastrar, editar, desativar; saída ou ajuste | Sim | Não |
| Preço do ouro, Importação | Sim | Não |
| Relatórios | Sim | Não |
| Usuários, Cadastros, Configurações, Auditoria | Sim | Não |
