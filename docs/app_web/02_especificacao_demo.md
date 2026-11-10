# Aplicação web Nobreza Jóias — 02. Especificação da demonstração

**Status:** versão 0.1, **aprovada pelo usuário em 2026-11-10**, incluindo as decisões E1 a E7. Detalha o plano aprovado em `01_planejamento.md` (v0.2). Nada aqui foi implementado. A DDL é uma proposta e não foi aplicada a nenhum banco.

**Escopo:** a demonstração funcional com dados fictícios (trilha da demonstração, seção F.1 do plano): regras de negócio com critérios de aceite, perfis e permissões, modelo lógico, operações de estoque, telas e dados de demonstração. A trilha do cliente não é coberta.

**Marcas de origem:** as mesmas do plano. **[H]** indica hipótese adotada para a demonstração, a rever com o parceiro; a pergunta correspondente (Q1…Q19) está na seção G.1 do plano.

## 1. Decisões desta especificação

Estas decisões são novas em relação ao plano e foram aprovadas pelo usuário em 2026-11-10.

| # | Decisão | Motivo |
|---|---|---|
| E1 | As cinco operações que alteram o estoque são **funções PL/pgSQL**, e são o único caminho de escrita nas tabelas de venda, movimentação e saldo. O papel de banco usado pela aplicação não tem INSERT, UPDATE nem DELETE nessas tabelas | Os invariantes I1 a I7 passam a valer por construção, mesmo que uma tela tenha defeito. O projeto já tem maturidade em PL/pgSQL. Custo: a regra de estoque fica em SQL e o restante em TypeScript |
| E2 | A camada de servidor em TypeScript valida a entrada, verifica a permissão, chama a função e traduz o erro. Cadastros (produtos, domínios, usuários, rascunho de compra) são escritos por ela diretamente | Mantém a camada de domínio isolada prevista na seção D.4 do plano |
| E3 | Exclusão física não existe na demonstração: cadastros são desativados | Menos caminhos a testar; nenhum histórico é perdido |
| E4 | O desconto não é armazenado: é a diferença entre o preço de tabela e o preço praticado do item. Desconto sobre o total da venda fica fora (Q5) | Evita dois campos que podem divergir |
| E5 | A confirmação de compra dispensa chave de idempotência: a passagem de RASCUNHO para CONFIRMADA, feita com bloqueio da linha, já impede a confirmação dupla. A chave continua obrigatória na venda | Refina o invariante I9 do plano |
| E6 | Os dados fictícios são marcados no nível do ambiente (variável `APP_AMBIENTE=DEMONSTRACAO`, que liga uma faixa de aviso em todas as telas) e pelo prefixo `FIC-` nos códigos de produto | Evita uma coluna de marcação em todas as tabelas de um banco que, em produção, só terá dados reais |
| E7 | Forma de pagamento, locais de estoque, parâmetro de preço, agrupamento por modelo, fotos e clientes ficam fora da demonstração | Dependem de Q1, Q3, Q5, Q6, Q9 e Q14 |

## 2. Perfis e permissões

Dois perfis: **Administrador** e **Vendedor**. A permissão é verificada na camada de servidor em toda operação; as funções de estoque repetem a verificação do perfil no banco. A interface apenas esconde o que o perfil não pode usar.

| Ação | Administrador | Vendedor |
|---|---|---|
| Entrar, sair, trocar a própria senha | Sim | Sim |
| Consultar produtos e saldos | Sim | Sim |
| Ver custos (compras, custo das entradas) | Sim | Não [H] (Q8) |
| Registrar venda | Sim | Sim |
| Consultar vendas | Todas | Todas [H] |
| Cancelar venda | Sim | Não |
| Cadastrar e editar produtos; implantar saldo inicial | Sim | Não |
| Saída não comercial e ajuste | Sim | Não |
| Compras (rascunho, confirmação, cancelamento, consulta) | Sim | Não |
| Consultas operacionais (parados, mais vendidos, sem estoque) | Sim | Sim, sem valores de custo |
| Relatórios do Power BI | Sim | Não [H] |
| Materiais, categorias e subcategorias | Sim | Não |
| Usuários e configurações | Sim | Não |

## 3. Regras de negócio e critérios de aceite

Cada regra tem um identificador. Os critérios de aceite (CA) viram testes nas tarefas.

### 3.1 Acesso

- **RN-01 Login.** Login e senha. Mensagem única para login inexistente, senha errada ou usuário inativo.
  - CA: com credenciais corretas, o usuário chega à tela inicial; com qualquer erro, a mensagem é a mesma e não revela qual campo falhou.
- **RN-02 Bloqueio temporário.** Depois de 5 falhas seguidas, o login fica bloqueado por 15 minutos. Um login correto zera a contagem.
  - CA: a sexta tentativa dentro do bloqueio é recusada mesmo com a senha certa.
- **RN-03 Senha.** Mínimo de 10 caracteres. Armazenada apenas como hash Argon2id. Nunca aparece em log, auditoria ou resposta.
- **RN-04 Troca obrigatória.** Usuário criado ou com senha redefinida pelo administrador precisa trocar a senha no primeiro acesso, antes de usar qualquer outra tela.
- **RN-05 Sessão.** Sessão no servidor, identificada por um token aleatório guardado só em forma de hash. Cookie `HttpOnly`, `SameSite=Lax` e `Secure` fora do ambiente local. Expira após 8 horas sem uso e, em qualquer caso, após 7 dias. Sair revoga a sessão. Desativar um usuário ou redefinir a sua senha revoga todas as sessões dele.
  - CA: uma sessão revogada ou expirada leva ao login em qualquer rota protegida.
- **RN-06 Usuários.** Só o administrador cria, edita, desativa e redefine senhas. O login é único e não muda depois de criado. O sistema não permite desativar o último administrador ativo.
- **RN-07 Primeiro administrador.** Criado por comando de linha, com a senha digitada na hora. Nenhuma senha fica em arquivo versionado.

### 3.2 Cadastros de domínio

- **RN-10** Material, categoria e subcategoria têm nome único (sem diferenciar maiúsculas) e podem ser desativados. A subcategoria pertence a uma categoria e é opcional no produto.
- **RN-11** Um item desativado não aparece para novos cadastros, mas continua visível nos produtos que já o usam.
- **RN-12** Os valores iniciais vêm dos dados de demonstração e são fictícios [H]. A lista real depende de Q2.

### 3.3 Produtos

- **RN-20 Código.** Único, obrigatório, gravado em maiúsculas e sem espaços nas pontas. Não muda depois que o produto tem movimentação.
- **RN-21 Campos.** Obrigatórios: código, descrição, material, categoria e modo de controle. Opcionais: subcategoria, peso em gramas, tamanho, pedras (texto), preço de venda, estoque mínimo e observação.
- **RN-22 Modo de controle.** `UNITARIO` (peça única; saldo 0 ou 1) ou `QUANTIDADE` (vários itens iguais sob o mesmo código). Definido por produto, sem relação com o material. Não muda depois que o produto tem movimentação.
- **RN-23 Edição.** Toda alteração grava em auditoria os valores de antes e de depois.
- **RN-24 Desativação.** Só com saldo zero [H]. Produto inativo não pode ser vendido, comprado nem movimentado, e pode ser reativado.
  - CA: desativar um produto com saldo é recusado, com mensagem clara.
- **RN-25 Busca.** Por código (início) ou descrição (qualquer trecho), com filtros de material, categoria, situação e "somente com saldo".

### 3.4 Estoque

- **RN-30 Fonte única.** O saldo só muda por uma movimentação, e toda movimentação é gravada pela função de estoque. Movimentações não são alteradas nem apagadas.
  - CA (I2): para todo produto, o saldo é igual à soma de quantidade × sinal das suas movimentações. A verificação existe como consulta e roda nos testes depois de cada cenário.
- **RN-31 Saldo não negativo (I1).** Nenhuma operação deixa o saldo abaixo de zero.
  - CA: duas vendas simultâneas da última unidade resultam em uma confirmada e uma recusada.
- **RN-32 Peça única (I3).** Produto `UNITARIO` nunca passa de saldo 1.
- **RN-33 Implantação.** Saldo inicial de um produto sem nenhuma movimentação, com custo unitário opcional. Uma única vez por produto.
- **RN-34 Saída não comercial.** Tipos presente, perda e roubo. Exige motivo. Não gera venda nem faturamento (I7).
- **RN-35 Ajuste.** Positivo ou negativo, com motivo obrigatório.
- **RN-36 Data da ocorrência.** Toda movimentação guarda a data em que o fato aconteceu (informada, nunca futura) e o momento do registro (automático).
- **RN-37 Histórico.** A tela do produto lista as movimentações, da mais recente para a mais antiga, com tipo, quantidade, saldo após, data, usuário e motivo.

### 3.5 Vendas

- **RN-40 Composição.** Uma venda tem de 1 a N itens, sem repetir produto. Cada item tem quantidade e preço praticado unitário (I8).
- **RN-41 Preço.** O preço de tabela do item é o preço de venda do cadastro no momento da venda (pode estar vazio). O preço praticado é obrigatório, maior ou igual a zero, e pode ser alterado por quem registra a venda.
- **RN-42 Confirmação.** A venda só existe depois de confirmada. A confirmação grava a venda, os itens e uma saída por item, numa única transação (I4), e atribui um número sequencial único. A numeração pode ter lacunas e não tem valor fiscal.
  - CA: se qualquer item não tiver saldo, nada é gravado e a mensagem identifica o produto.
- **RN-43 Idempotência (I9).** A tela gera uma chave ao abrir a venda. Reenviar a mesma chave devolve a venda já gravada, sem duplicar.
  - CA: duas confirmações com a mesma chave, inclusive simultâneas, geram uma venda e uma saída por item.
- **RN-44 Data da venda (I10).** Informada, com o dia atual como padrão; nunca futura. Data anterior é permitida [H] (Q19).
- **RN-45 Cancelamento.** Só o administrador, com motivo. A venda passa a CANCELADA e cada item recebe um estorno ligado à saída original (I5). Uma venda é cancelada no máximo uma vez. Não existe cancelamento parcial.
  - CA: depois do cancelamento, o saldo volta ao valor anterior à venda e as movimentações originais continuam intactas.
- **RN-46 Peça única devolvida.** O estorno de um produto `UNITARIO` cujo saldo já voltou a 1 por outro caminho é recusado, e o cancelamento inteiro falha.
- **RN-47 Consulta.** Lista por período, com número, data, vendedor, quantidade de itens, total e situação; detalhe com os itens.

### 3.6 Compras

- **RN-50 Rascunho.** A compra nasce como RASCUNHO e pode ser editada e retomada depois. Itens: produto, quantidade e custo unitário, sem repetir produto.
- **RN-51 Cadastro rápido.** Dentro do rascunho é possível cadastrar um produto novo com os campos obrigatórios, sem sair da tela.
- **RN-52 Confirmação.** Gera uma entrada por item, com o custo unitário, na mesma transação (I4). Depois de confirmada, a compra não é mais editada.
  - CA: item de produto `UNITARIO` com quantidade diferente de 1, ou com saldo já igual a 1, impede a confirmação.
- **RN-53 Cancelamento.** Só de compra confirmada, com motivo, e apenas se todos os itens ainda tiverem saldo suficiente para o estorno. Um rascunho é descartado mudando a situação para CANCELADA, sem movimentação.
- **RN-54 Custo.** O custo fica no item da compra e na movimentação de entrada. Não há custo médio, margem, CMV nem estoque valorizado.

### 3.7 Consultas

- **RN-60 Sem estoque.** Produtos ativos com saldo zero.
- **RN-61 Parados.** Produtos ativos com saldo maior que zero e sem venda confirmada nos últimos N dias. N é configurável, com padrão de 180 [H] (Q11). Um produto que nunca vendeu conta a partir da primeira entrada.
- **RN-62 Mais vendidos.** Soma das quantidades em vendas confirmadas no período. Vendas canceladas não contam.
- **RN-63 Baixo estoque.** Só para produtos com estoque mínimo informado: saldo menor ou igual ao mínimo.
- **RN-64 Tela inicial.** Quantidade e valor das vendas confirmadas do dia e do mês, últimas vendas e atalhos para registrar venda e consultar produtos.
- **RN-65** Quantidades em peças e valores em reais nunca são somados entre si; peso não entra em nenhuma soma.

### 3.8 Relatórios do Power BI

- **RN-70** A tela Relatórios exibe, num quadro, o relatório publicado. O endereço vem da variável de ambiente `POWERBI_URL_RELATORIO`; sem ela, a tela explica que o relatório não está configurado.
- **RN-71** A tela exibe o aviso "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA." e informa que os números do relatório não vêm dos lançamentos feitos na aplicação.
- **RN-72** O endereço só é enviado ao navegador de quem tem permissão para a tela. Isso não torna o relatório privado: o link do "Publicar na Web" é público por natureza e só pode apontar para dados sintéticos.

### 3.9 Auditoria

- **RN-80** São registrados: login com sucesso e com falha, saída, criação e alteração de usuário, redefinição de senha, alteração de cadastros de domínio, de produto e de configuração. As operações de estoque já deixam o seu próprio registro imutável.
- **RN-81** O registro guarda quem, quando, a ação, a entidade e os valores de antes e depois, sem senha nem hash. Só o administrador consulta.

## 4. Modelo lógico

Banco `nobreza_app` (desenvolvimento e demonstração) e `nobreza_app_teste` (testes), ambos no PostgreSQL 18 local, separados de `dw_joalheria`. Um único esquema, `app`.

### 4.1 Papéis de banco

| Papel | Uso | Privilégios |
|---|---|---|
| `nobreza_migracao` | Dono do esquema; aplica migrations | Todos, no esquema `app` |
| `nobreza_aplicacao` | Conexão da aplicação | SELECT em tudo; INSERT e UPDATE nos cadastros, sessão, auditoria (só INSERT), configuração e rascunho de compra; EXECUTE nas funções de estoque. **Sem** escrita direta em `venda`, `venda_item`, `movimentacao_estoque` e `saldo_estoque` |

O papel de leitura para o ETL fica para a etapa A8. A aplicação nunca se conecta como `postgres`.

### 4.2 DDL proposta

Convenções: chaves `bigint` geradas pelo banco; `timestamptz` para momentos e `date` para datas de negócio; valores em `numeric(14,2)`; quantidades inteiras, em peças; nada exclusivo do PostgreSQL 18.

```sql
create schema app;

create table app.usuario (
  id                bigint generated always as identity primary key,
  nome              text not null check (btrim(nome) <> ''),
  login             text not null unique check (login ~ '^[a-z0-9._-]{3,40}$'),
  senha_hash        text not null,
  perfil            text not null check (perfil in ('ADMINISTRADOR', 'VENDEDOR')),
  ativo             boolean not null default true,
  deve_trocar_senha boolean not null default true,
  falhas_login      integer not null default 0 check (falhas_login >= 0),
  bloqueado_ate     timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create table app.sessao (
  token_hash    text primary key,
  usuario_id    bigint not null references app.usuario,
  criada_em     timestamptz not null default now(),
  ultimo_uso_em timestamptz not null default now(),
  expira_em     timestamptz not null,
  revogada_em   timestamptz
);

create table app.material (
  id    bigint generated always as identity primary key,
  nome  text not null check (btrim(nome) <> ''),
  ativo boolean not null default true
);
create unique index material_nome_uk on app.material (lower(nome));

create table app.categoria (
  id    bigint generated always as identity primary key,
  nome  text not null check (btrim(nome) <> ''),
  ativo boolean not null default true
);
create unique index categoria_nome_uk on app.categoria (lower(nome));

create table app.subcategoria (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references app.categoria,
  nome         text not null check (btrim(nome) <> ''),
  ativo        boolean not null default true,
  unique (id, categoria_id)
);
create unique index subcategoria_nome_uk on app.subcategoria (categoria_id, lower(nome));

create table app.produto (
  id              bigint generated always as identity primary key,
  codigo          text not null unique check (codigo <> '' and codigo = upper(btrim(codigo))),
  descricao       text not null check (btrim(descricao) <> ''),
  material_id     bigint not null references app.material,
  categoria_id    bigint not null references app.categoria,
  subcategoria_id bigint,
  modo_controle   text not null check (modo_controle in ('UNITARIO', 'QUANTIDADE')),
  peso_gramas     numeric(10,3) check (peso_gramas > 0),
  tamanho         text,
  pedras          text,
  preco_venda     numeric(14,2) check (preco_venda >= 0),
  estoque_minimo  integer check (estoque_minimo >= 0),
  observacao      text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  foreign key (subcategoria_id, categoria_id) references app.subcategoria (id, categoria_id)
);

create table app.saldo_estoque (
  produto_id    bigint primary key references app.produto,
  quantidade    integer not null default 0 check (quantidade >= 0),
  atualizado_em timestamptz not null default now()
);

create table app.tipo_movimentacao (
  codigo         text primary key,
  descricao      text not null,
  sinal          smallint not null check (sinal in (-1, 1)),
  eh_venda       boolean not null default false,
  exige_motivo   boolean not null default false,
  origem_exigida text not null check (origem_exigida in ('NENHUMA', 'VENDA_ITEM', 'COMPRA_ITEM')),
  uso_manual     boolean not null default false
);

create sequence app.venda_numero_seq;

create table app.venda (
  id                  bigint generated always as identity primary key,
  numero              bigint not null unique default nextval('app.venda_numero_seq'),
  chave_idempotencia  uuid not null unique,
  data_venda          date not null,
  situacao            text not null default 'CONFIRMADA' check (situacao in ('CONFIRMADA', 'CANCELADA')),
  vendedor_id         bigint not null references app.usuario,
  valor_total         numeric(14,2) not null check (valor_total >= 0),
  observacao          text,
  registrada_em       timestamptz not null default now(),
  cancelada_em        timestamptz,
  cancelada_por       bigint references app.usuario,
  motivo_cancelamento text,
  check (data_venda <= (registrada_em at time zone 'America/Sao_Paulo')::date),
  check ((situacao = 'CANCELADA')
         = (cancelada_em is not null and cancelada_por is not null
            and btrim(coalesce(motivo_cancelamento, '')) <> ''))
);

create table app.venda_item (
  id              bigint generated always as identity primary key,
  venda_id        bigint not null references app.venda,
  produto_id      bigint not null references app.produto,
  quantidade      integer not null check (quantidade > 0),
  preco_tabela    numeric(14,2) check (preco_tabela >= 0),
  preco_praticado numeric(14,2) not null check (preco_praticado >= 0),
  valor_item      numeric(14,2) generated always as (quantidade * preco_praticado) stored,
  unique (venda_id, produto_id)
);

create table app.compra (
  id                  bigint generated always as identity primary key,
  data_compra         date not null,
  situacao            text not null default 'RASCUNHO' check (situacao in ('RASCUNHO', 'CONFIRMADA', 'CANCELADA')),
  observacao          text,
  criada_por          bigint not null references app.usuario,
  criada_em           timestamptz not null default now(),
  confirmada_por      bigint references app.usuario,
  confirmada_em       timestamptz,
  cancelada_por       bigint references app.usuario,
  cancelada_em        timestamptz,
  motivo_cancelamento text
);

create table app.compra_item (
  id             bigint generated always as identity primary key,
  compra_id      bigint not null references app.compra,
  produto_id     bigint not null references app.produto,
  quantidade     integer not null check (quantidade > 0),
  custo_unitario numeric(14,2) not null check (custo_unitario >= 0),
  unique (compra_id, produto_id)
);

create table app.movimentacao_estoque (
  id              bigint generated always as identity primary key,
  produto_id      bigint not null references app.produto,
  tipo_codigo     text not null references app.tipo_movimentacao,
  quantidade      integer not null check (quantidade > 0),
  saldo_apos      integer not null check (saldo_apos >= 0),
  custo_unitario  numeric(14,2) check (custo_unitario >= 0),
  motivo          text,
  venda_item_id   bigint references app.venda_item,
  compra_item_id  bigint references app.compra_item,
  estorna_id      bigint unique references app.movimentacao_estoque,
  data_ocorrencia date not null,
  usuario_id      bigint not null references app.usuario,
  registrada_em   timestamptz not null default now(),
  check (venda_item_id is null or compra_item_id is null),
  check (data_ocorrencia <= (registrada_em at time zone 'America/Sao_Paulo')::date)
);
create index movimentacao_produto_ix on app.movimentacao_estoque (produto_id, id);

create table app.auditoria (
  id           bigint generated always as identity primary key,
  ocorrido_em  timestamptz not null default now(),
  usuario_id   bigint references app.usuario,
  acao         text not null,
  entidade     text not null,
  entidade_id  text,
  dados_antes  jsonb,
  dados_depois jsonb
);

create table app.configuracao (
  chave          text primary key,
  valor          text not null,
  descricao      text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por bigint references app.usuario
);
```

Complementos da DDL:

- Gatilhos que recusam UPDATE e DELETE em `movimentacao_estoque` e `venda_item`, e DELETE em `venda`, `compra`, `compra_item` confirmada e `auditoria` (I6).
- Gatilho que recusa alteração de `compra_item` quando a compra não está em RASCUNHO.
- `estorna_id` único garante que uma movimentação é estornada no máximo uma vez (I5).
- A chave estrangeira composta de `produto` garante que a subcategoria pertence à categoria do produto.

### 4.3 Tipos de movimentação iniciais

| Código | Sinal | É venda | Exige motivo | Origem exigida | Uso manual |
|---|---|---|---|---|---|
| IMPLANTACAO | +1 | não | não | NENHUMA | sim |
| ENTRADA_COMPRA | +1 | não | não | COMPRA_ITEM | não |
| ESTORNO_COMPRA | −1 | não | sim | COMPRA_ITEM | não |
| SAIDA_VENDA | −1 | sim | não | VENDA_ITEM | não |
| ESTORNO_VENDA | +1 | não | sim | VENDA_ITEM | não |
| SAIDA_PRESENTE | −1 | não | sim | NENHUMA | sim |
| SAIDA_PERDA | −1 | não | sim | NENHUMA | sim |
| SAIDA_ROUBO | −1 | não | sim | NENHUMA | sim |
| AJUSTE_POSITIVO | +1 | não | sim | NENHUMA | sim |
| AJUSTE_NEGATIVO | −1 | não | sim | NENHUMA | sim |

Os códigos coincidem com os de `dim_tipo_movimentacao` sempre que o tipo existe na demonstração do DW, para o ETL futuro mapear sem tradução. A tela de gestão de tipos fica fora da demonstração; o domínio vive na tabela.

### 4.4 Operações de estoque (funções)

Todas são `SECURITY DEFINER`, com `search_path` fixo, pertencem a `nobreza_migracao` e rodam numa única transação. Bloqueiam as linhas de saldo em ordem crescente de `produto_id`, para evitar bloqueio mútuo.

| Função | Entrada | Efeito | Perfil exigido |
|---|---|---|---|
| `app.movimentar_manual` | produto, tipo, quantidade, data da ocorrência, motivo, custo unitário, usuário | Uma movimentação de tipo com `uso_manual` e a atualização do saldo | Administrador |
| `app.confirmar_venda` | chave, usuário, data da venda, observação, itens (produto, quantidade, preço praticado) | Venda, itens e uma SAIDA_VENDA por item; devolve a venda existente se a chave já foi usada | Administrador ou Vendedor |
| `app.cancelar_venda` | venda, usuário, motivo | Venda CANCELADA e um ESTORNO_VENDA por item | Administrador |
| `app.confirmar_compra` | compra, usuário | Compra CONFIRMADA e uma ENTRADA_COMPRA por item, com o custo | Administrador |
| `app.cancelar_compra` | compra, usuário, motivo | Rascunho: só muda a situação. Confirmada: CANCELADA e um ESTORNO_COMPRA por item | Administrador |

Uma função interna, sem EXECUTE para a aplicação, concentra a escrita: bloqueia o saldo, valida produto ativo, sinal, saldo suficiente, limite da peça única, motivo e coerência entre o tipo e a origem, grava a movimentação com o saldo resultante e atualiza o saldo.

Erros de negócio são sinalizados com códigos próprios, que a camada de servidor traduz em mensagens:

| Código | Situação |
|---|---|
| NJ001 | Saldo insuficiente |
| NJ002 | Peça única com saldo acima de 1 |
| NJ003 | Produto inexistente ou inativo |
| NJ004 | Usuário inexistente, inativo ou sem o perfil exigido |
| NJ005 | Situação inválida para a operação (venda já cancelada, compra já confirmada) |
| NJ006 | Dados inválidos (sem itens, produto repetido, quantidade, preço, data futura, motivo ausente, tipo não permitido) |
| NJ007 | Implantação em produto que já tem movimentação |

### 4.5 Configuração inicial

| Chave | Valor padrão | Uso |
|---|---|---|
| `dias_produto_parado` | 180 [H] | RN-61 |

Variáveis de ambiente (nunca versionadas com valor): `DATABASE_URL` (papel da aplicação), `DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE`, `DATABASE_URL_TESTE_MIGRACAO`, `APP_AMBIENTE` (`DEMONSTRACAO` ou `PRODUCAO`) e `POWERBI_URL_RELATORIO`.

## 5. Telas e navegação

Interface em português do Brasil, valores em reais e datas no formato dia/mês/ano, no fuso de São Paulo. Largura mínima de 360 px. No celular, a navegação fica num menu recolhido; no desktop, numa barra lateral. Em `DEMONSTRACAO`, uma faixa fixa informa que os dados são fictícios.

| Rota | Tela | Conteúdo | Tarefa |
|---|---|---|---|
| `/login` | Login | Login, senha, mensagem de erro única | T01 |
| `/trocar-senha` | Troca de senha | Senha atual, nova e confirmação; obrigatória no primeiro acesso | T01 |
| `/` | Início | Atalhos; em T05, os números de RN-64 | T01, T05 |
| `/relatorios` | Relatórios | Avisos de RN-71 e o quadro com o relatório | T01 |
| `/admin/usuarios` | Usuários | Lista, criar, editar, desativar, redefinir senha | T01 |
| `/admin/cadastros` | Cadastros | Materiais, categorias e subcategorias | T01 |
| `/admin/configuracoes` | Configurações | Parâmetros de 4.5 | T01 |
| `/admin/auditoria` | Auditoria | Lista filtrável por período, usuário e entidade | T01 |
| `/produtos` | Produtos | Busca e filtros de RN-25; lista com código, descrição, categoria, saldo e preço | T02 |
| `/produtos/novo`, `/produtos/[id]/editar` | Cadastro de produto | Campos de RN-21; saldo inicial opcional no cadastro novo | T02 |
| `/produtos/[id]` | Detalhe do produto | Dados, saldo e histórico de RN-37 | T02 |
| `/estoque/movimentar` | Saída ou ajuste | Produto, tipo, quantidade, data e motivo | T02 |
| `/vendas/nova` | Nova venda | Busca de produto, lista de itens com quantidade e preço, total, data e confirmar | T03 |
| `/vendas`, `/vendas/[id]` | Vendas | Lista por período; detalhe com itens e cancelamento | T03 |
| `/compras`, `/compras/[id]` | Compras | Lista; rascunho com itens, cadastro rápido, confirmar e cancelar | T04 |
| `/consultas` | Consultas | Sem estoque, parados, mais vendidos, baixo estoque | T05 |

Fluxo de venda no celular, que é o caminho mais usado: Início → Nova venda → digitar código ou descrição → tocar no produto (entra com quantidade 1 e o preço do cadastro) → ajustar o preço, se preciso → Confirmar → tela da venda com o número. São cinco toques para uma peça com preço de tabela.

## 6. Dados de demonstração

- Carregados por comando explícito (`npm run demo:carregar`), que recusa a execução com `APP_AMBIENTE=PRODUCAO` e em banco que já tenha movimentações.
- Inteiramente fictícios: nada é copiado nem derivado das planilhas reais ou do DW sintético. Códigos com prefixo `FIC-`.
- Conteúdo: 3 materiais, cerca de 8 categorias e algumas subcategorias; cerca de 40 produtos, misturando `UNITARIO` e `QUANTIDADE`; 2 compras confirmadas e 1 em rascunho; cerca de 15 vendas em dias diferentes, 1 delas cancelada; 1 presente, 1 perda e 1 ajuste.
- As operações são geradas pelas próprias funções de estoque, de modo que os invariantes valem também para os dados de demonstração.
- Os usuários de demonstração são criados pelo comando, com senhas lidas de variáveis de ambiente locais; nenhuma senha fica no repositório.

## 7. Testes

| Nível | Alvo | Onde roda |
|---|---|---|
| Unitário | Validação de entrada, permissões, tradução de erros | Sem banco |
| Integração | Migrations, privilégios do papel da aplicação, funções de estoque, invariantes I1 a I10, concorrência (RN-31, RN-43) | `nobreza_app_teste` |
| Ponta a ponta | Login e fluxo de venda, se o prazo permitir | Aplicação em execução |

Os testes de integração recriam o esquema `app` do banco de teste. A rotina recusa a execução se o nome do banco não terminar em `_teste`. Os testes rodam a aplicação com o papel `nobreza_aplicacao`, e não com o dono do esquema, para que os privilégios também sejam testados.

## 8. Fora da demonstração

Clientes, fornecedores, financeiro, fotos, comprovantes, exportação, recuperação de senha por e-mail, locais de estoque e consignação, preço por índice, agrupamento por modelo, forma de pagamento, desconto sobre o total, devolução e troca, cancelamento parcial, gestão de tipos de movimentação pela interface, exclusão física, modo offline, hospedagem e integração com o DW (A8).
