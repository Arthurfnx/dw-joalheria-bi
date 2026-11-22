# Aplicação web Nobreza Jóias — Especificação

**Versão:** 0.2 (novembro de 2026).

**Escopo:** a primeira versão da aplicação: regras de negócio com critérios de aceite, perfis e permissões, invariantes de estoque, modelo lógico, operações de estoque, telas e importação dos dados das planilhas.

Regras marcadas como *(a confirmar)* foram adotadas sem confirmação do proprietário da joalheria e podem mudar.

## 1. Decisões desta especificação

Decisões técnicas que orientam a implementação.

| # | Decisão | Motivo |
|---|---|---|
| E1 | As cinco operações que alteram o estoque são **funções PL/pgSQL**, e são o único caminho de escrita nas tabelas de venda, movimentação e saldo. O papel de banco usado pela aplicação não tem INSERT, UPDATE nem DELETE nessas tabelas | Os invariantes I1 a I7 passam a valer por construção, mesmo que uma tela tenha defeito. O projeto já tem maturidade em PL/pgSQL. Custo: a regra de estoque fica em SQL e o restante em TypeScript |
| E2 | A camada de servidor em TypeScript valida a entrada, verifica a permissão, chama a função e traduz o erro. Cadastros (produtos, domínios, usuários, rascunho de compra) são escritos por ela diretamente | Mantém a camada de domínio isolada |
| E3 | Exclusão física não existe: cadastros são desativados | Menos caminhos a testar; nenhum histórico é perdido |
| E4 | O desconto não é armazenado: é a diferença entre o preço de tabela e o preço praticado do item. Desconto sobre o total da venda fica fora | Evita dois campos que podem divergir |
| E5 | A confirmação de compra dispensa chave de idempotência: a passagem de RASCUNHO para CONFIRMADA, feita com bloqueio da linha, já impede a confirmação dupla. A chave continua obrigatória na venda | Refina o invariante I9 |
| E7 | Forma de pagamento, agrupamento por modelo, fotos e clientes ficam fora. Locais de estoque entram só como atributo do produto, para a consignação (seção 6). O preço do ouro entra (3.7A) | Dependem de definições do proprietário |
| E8 | O nome da pessoa com quem a peça está consignada é guardado na aplicação, mas nunca sai dela: o papel de leitura do DW não enxerga essa coluna (seção 6A) | O relatório do Power BI é público |
| E9 | A importação lê o XLSX em Node.js, com a biblioteca ExcelJS, dentro de `web/`, e não em Python | Um único projeto e uma única sessão de código; o prazo não comporta uma segunda cadeia de ferramentas |
| E10 | Compras e consultas operacionais ficam para uma versão posterior. As consultas são cobertas pelo relatório do Power BI | Escopo da primeira versão |
| E11 | O catálogo de ouro (CLS) é importado com todas as peças em estoque, saldo 1, sem valor nem data de aquisição; o tamanho só existe em anéis; cada peça tem índice de preço; o preço do ouro é registrado pelo cliente e gera preço sugerido; associação e ticket médio ficam no relatório, só com vendas da aplicação | Regras de negócio da joalheria |

## 1A. Invariantes de estoque e venda

Válidos em qualquer operação e cobertos por testes de integração no PostgreSQL.

- **I1** O saldo nunca é negativo. Não há exceção.
- **I2** O saldo de cada produto é igual a Σ (quantidade × sinal) das suas movimentações, e isso pode ser verificado a qualquer momento.
- **I3** Produto UNITARIO tem saldo 0 ou 1.
- **I4** Cada item de venda confirmada gera exatamente uma SAIDA_VENDA de mesma quantidade, na mesma transação. O mesmo vale para compra e ENTRADA_COMPRA.
- **I5** O cancelamento não apaga nem altera movimentações: gera um estorno vinculado, e uma venda só pode ser cancelada uma vez.
- **I6** Movimentações e itens confirmados são imutáveis para o papel da aplicação.
- **I7** Saídas não comerciais e ajustes exigem motivo e usuário e nunca geram faturamento.
- **I8** O preço praticado é unitário, e o valor do item é quantidade × preço praticado. Peso nunca é somado a quantidade.
- **I9** A confirmação de venda ou de compra é idempotente: a mesma chave de confirmação, enviada duas vezes (toque duplo ou reenvio em rede instável), gera uma única operação.
- **I10** A venda guarda a data em que aconteceu (informada, nunca futura) e o momento do registro (automático). O lançamento com data anterior é permitido.

## 2. Perfis e permissões

Dois perfis: **Administrador** e **Vendedor**. A permissão é verificada na camada de servidor em toda operação; as funções de estoque repetem a verificação do perfil no banco. A interface apenas esconde o que o perfil não pode usar.

| Ação | Administrador | Vendedor |
|---|---|---|
| Entrar, sair, trocar a própria senha | Sim | Sim |
| Consultar produtos e saldos | Sim | Sim |
| Ver custos (compras, custo das entradas) | Sim | Não (a confirmar) |
| Registrar venda | Sim | Sim |
| Consultar vendas | Todas | Todas (a confirmar) |
| Cancelar venda | Sim | Não |
| Cadastrar e editar produtos; implantar saldo inicial | Sim | Não |
| Saída não comercial e ajuste | Sim | Não |
| Compras (rascunho, confirmação, cancelamento, consulta) | Sim | Não |
| Consultas operacionais (parados, mais vendidos, sem estoque) | Sim | Sim, sem valores de custo |
| Relatórios do Power BI | Sim | Não (a confirmar) |
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
- **RN-12** Os materiais e as categorias iniciais são criados pela importação (seção 6). A lista definitiva depende do proprietário.

### 3.3 Produtos

- **RN-20 Código.** Único, obrigatório, gravado em maiúsculas e sem espaços nas pontas. Não muda depois que o produto tem movimentação.
- **RN-21 Campos.** Obrigatórios: código, descrição, material, categoria e modo de controle. Opcionais: subcategoria, peso em gramas, tamanho, índice de preço, valor de aquisição, data de aquisição (nunca futura), pedras (texto), preço de venda, estoque mínimo, local e observação. Valor e data de aquisição podem ficar vazios e ser preenchidos depois, com auditoria; o vendedor não os vê.
- **RN-21A Tamanho só em anéis.** O campo tamanho só aparece e só é aceito quando a categoria do produto permite tamanho (`categoria.usa_tamanho`; ligado nas categorias Anel e Aliança). Nas demais, a tela não mostra o campo e o banco recusa o valor.
- **RN-21B Entrada de peça nova.** No cadastro de uma peça com saldo inicial, a implantação usa o valor de aquisição como custo e a data de aquisição como data da ocorrência (sem data, a data do dia).
- **RN-22 Modo de controle.** `UNITARIO` (peça única; saldo 0 ou 1) ou `QUANTIDADE` (vários itens iguais sob o mesmo código). Definido por produto, sem relação com o material. Não muda depois que o produto tem movimentação.
- **RN-23 Edição.** Toda alteração grava em auditoria os valores de antes e de depois.
- **RN-24 Desativação.** Só com saldo zero (a confirmar). Produto inativo não pode ser vendido, comprado nem movimentado, e pode ser reativado.
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
- **RN-44 Data da venda (I10).** Informada, com o dia atual como padrão; nunca futura. Data anterior é permitida (a confirmar).
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
- **RN-61 Parados.** Produtos ativos com saldo maior que zero e sem venda confirmada nos últimos N dias. N é configurável, com padrão de 180 (a confirmar). Um produto que nunca vendeu conta a partir da primeira entrada.
- **RN-62 Mais vendidos.** Soma das quantidades em vendas confirmadas no período. Vendas canceladas não contam.
- **RN-63 Baixo estoque.** Só para produtos com estoque mínimo informado: saldo menor ou igual ao mínimo.
- **RN-64 Tela inicial.** Quantidade e valor das vendas confirmadas do dia e do mês, últimas vendas e atalhos para registrar venda e consultar produtos.
- **RN-65** Quantidades em peças e valores em reais nunca são somados entre si; peso não entra em nenhuma soma.

### 3.7A Preço do ouro e preço sugerido

- **RN-66 Registro.** O administrador registra o preço do ouro: valor em reais por grama de ouro 1000 (a confirmar) e data de vigência. Cada registro é imutável; uma correção é um novo registro. A tela mostra o histórico, do mais recente para o mais antigo, com quem registrou.
- **RN-67 Vigência.** O preço vigente numa data é o registro com a maior data de vigência menor ou igual a ela.
- **RN-68 Preço sugerido.** Para peça de material Ouro com índice de preço informado e preço do ouro vigente: preço sugerido = preço do ouro × fator × índice, arredondado em centavos. O fator fica na configuração `fator_preco_ouro`, com valor inicial 1,6. A fórmula ainda não foi confirmada com o proprietário (a confirmar). Sem algum dos três valores, não há preço sugerido e a tela diz o que falta.
- **RN-69 Uso.** O preço sugerido aparece na lista e no detalhe do produto e é o preço de tabela padrão na nova venda quando o produto não tem preço de venda cadastrado. O preço praticado continua editável. O cálculo é uma função do banco, usada pela aplicação e pelo DW.

### 3.8 Relatórios do Power BI

- **RN-70** A tela Relatórios exibe, num quadro, o relatório publicado. O endereço vem da variável de ambiente `POWERBI_URL_RELATORIO`; sem ela, a tela explica que o relatório não está configurado.
- **RN-73 Associação e ticket médio.** O relatório mantém a página de associação entre produtos e o ticket médio, calculados **somente** com as vendas registradas na aplicação, que têm número de venda. As vendas importadas da planilha ficam fora desses cálculos. No começo a página fica vazia e se preenche à medida que o cliente registra vendas.
- **RN-72** O endereço só é enviado ao navegador de quem tem permissão para a tela. Isso não torna o relatório privado: o link do "Publicar na Web" é público por natureza. Por isso o modelo publicado não contém nomes de pessoas (seção 6A e tarefa do DW).

### 3.9 Auditoria

- **RN-80** São registrados: login com sucesso e com falha, saída, criação e alteração de usuário, redefinição de senha, alteração de cadastros de domínio, de produto e de configuração. As operações de estoque já deixam o seu próprio registro imutável.
- **RN-81** O registro guarda quem, quando, a ação, a entidade e os valores de antes e depois, sem senha nem hash. Só o administrador consulta.

## 4. Modelo lógico

Banco `nobreza_app` (dados reais) e `nobreza_app_teste` (testes), ambos no PostgreSQL 18 local, separados de `dw_joalheria`. Um único esquema, `app`.

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
  id          bigint generated always as identity primary key,
  nome        text not null check (btrim(nome) <> ''),
  usa_tamanho boolean not null default false,
  ativo       boolean not null default true
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

Os códigos coincidem com os de `dim_tipo_movimentacao` sempre que o tipo existe no DW, para o ETL mapear sem tradução. A tela de gestão de tipos fica fora; o domínio vive na tabela.

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
| `dias_produto_parado` | 180 (a confirmar) | RN-61 |
| `fator_preco_ouro` | 1,6 (a confirmar) | RN-68 |

Variáveis de ambiente (nunca versionadas com valor): `DATABASE_URL` (papel da aplicação), `DATABASE_URL_MIGRACAO`, `DATABASE_URL_TESTE`, `DATABASE_URL_TESTE_MIGRACAO` e `POWERBI_URL_RELATORIO`.

## 5. Telas e navegação

Interface em português do Brasil, valores em reais e datas no formato dia/mês/ano, no fuso de São Paulo. Largura mínima de 360 px. No celular, a navegação fica num menu recolhido; no desktop, numa barra lateral. | Rota | Tela | Conteúdo | Situação |
|---|---|---|---|
| `/login` | Login | Login, senha, mensagem de erro única | Implementada |
| `/trocar-senha` | Troca de senha | Senha atual, nova e confirmação; obrigatória no primeiro acesso | Implementada |
| `/` | Início | Atalhos e totais de vendas do dia e do mês (RN-64) | Implementada |
| `/relatorios` | Relatórios | O quadro com o relatório | Implementada |
| `/admin/usuarios` | Usuários | Lista, criar, editar, desativar, redefinir senha | Implementada |
| `/admin/cadastros` | Cadastros | Materiais, categorias e subcategorias | Implementada |
| `/admin/configuracoes` | Configurações | Parâmetros de 4.5 | Implementada |
| `/admin/auditoria` | Auditoria | Lista filtrável por período, usuário e entidade | Implementada |
| `/produtos` | Produtos | Busca e filtros de RN-25; lista com código, descrição, categoria, saldo e preço | Implementada |
| `/produtos/novo`, `/produtos/[id]/editar` | Cadastro de produto | Campos de RN-21; saldo inicial opcional no cadastro novo | Implementada |
| `/produtos/[id]` | Detalhe do produto | Dados, saldo e histórico de RN-37 | Implementada |
| `/estoque/movimentar` | Saída ou ajuste | Produto, tipo, quantidade, data e motivo | Implementada |
| `/vendas/nova` | Nova venda | Busca de produto, lista de itens com quantidade e preço, total, data e confirmar | Implementada |
| `/vendas`, `/vendas/[id]` | Vendas | Lista por período; detalhe com itens e cancelamento | Implementada |
| `/compras`, `/compras/[id]` | Compras | Lista; rascunho com itens, cadastro rápido, confirmar e cancelar | Versão posterior |
| `/consultas` | Consultas | Sem estoque, parados, mais vendidos, baixo estoque | Versão posterior |

Fluxo de venda no celular, que é o caminho mais usado: Início → Nova venda → digitar código ou descrição → tocar no produto (entra com quantidade 1 e o preço do cadastro) → ajustar o preço, se preciso → Confirmar → tela da venda com o número. São cinco toques para uma peça com preço de tabela.

## 6. Importação dos dados reais

A aplicação começa com os dados reais das planilhas de `data/raw/`. A importação é feita **uma única vez**, num banco sem produtos, por comando de linha. Os arquivos de origem são abertos somente para leitura e nunca alterados. As contagens citadas vêm de `docs/source_inventory.md` (inspeção de 2026-10-31) e são conferidas pela própria importação.

### 6.1 Fontes e alcance

| Fonte | Tratamento |
|---|---|
| Aba FOLHEADOS (linhas 3–1543) | Fonte principal. Cada linha é uma peça |
| Aba RAMON - PEÇAS | Só entram as peças cujo código não existe em FOLHEADOS (274 dos 275 códigos já existem lá, com o mesmo custo). O bloco de colunas deslocadas, as linhas de serviço e conserto e o registro de pagamentos (linhas 288 em diante) não entram |
| Aba CATEGORIAS | Não usada (uma única célula) |
| CLS (catálogo de ouro) | **Importado**: cada linha é uma peça de ouro em estoque, saldo 1. Colunas: CODIGO, CATEGORIA, DESCRIÇÃO, PESO, Ø (tamanho, só em anéis) e Ind Preço. Não tem valor nem data de aquisição: os campos ficam vazios para o cliente preencher |

### 6.2 Regras de transformação

- **RN-90 Grão.** Uma linha da planilha é uma peça física: produto `UNITARIO` (a confirmar), nas três fontes. Nenhum produto `QUANTIDADE` é criado pela importação.
- **RN-91 Código.** Sem espaços nas pontas e em maiúsculas. Linhas com código "Serviço" não são peças e são rejeitadas. Códigos repetidos (6 casos observados) têm **todas** as ocorrências rejeitadas: a aplicação não inventa código. O administrador cadastra essas peças depois, à mão.
- **RN-92 Material.** Código no padrão `R07…` → Prata; padrão `N-NNNN` → Folheado (a confirmar); toda linha do CLS → Ouro. Código fora desses padrões é rejeitado. Um código do CLS que coincida com um de FOLHEADOS ou RAMON tem as duas ocorrências rejeitadas.
- **RN-93 Categoria.** FOLHEADOS e RAMON: a primeira palavra da descrição, comparada com uma tabela de grafias observadas (por exemplo, BRINCO, BINCO e BRNCO → Brinco). CLS: a coluna CATEGORIA, normalizada pela mesma tabela (18 grafias observadas, com maiúsculas e minúsculas misturadas). Palavra fora da tabela → categoria "A classificar", para revisão. As categorias Anel e Aliança são criadas com `usa_tamanho = true`. O prefixo numérico do código não é usado: o significado não foi confirmado.
- **RN-94 Demais campos.** Descrição como está, sem espaços nas pontas. Peso → `peso_gramas` (a confirmar) (unidade não declarada). Índice: coluna INDICE (FOLHEADOS) e Ind Preço (CLS) → `indice_preco`. Valor e data de aquisição: VALOR DE COMPRA e DATA DA COMPRA em FOLHEADOS e RAMON; vazios no CLS. A coluna de lucro e a coluna sem título são ignoradas.
- **RN-94A Tamanho.** TAMANHO (FOLHEADOS) e Ø (CLS) só são gravados em `tamanho` quando a categoria usa tamanho (RN-21A). Em outra categoria, o valor fica guardado em `produto_origem.tamanho_original` e a linha gera uma ocorrência REVISAR; nada é descartado em silêncio.
- **RN-95 Situação pelo local do estoque.**

| LOCAL DO ESTOQUE | Situação | Saldo | Local na aplicação |
|---|---|---|---|
| ESTOQUE, ARMARIO, MALETA 1, 2 MALETA, "novo" | Em estoque | 1 (implantação) | O mesmo, normalizado: Estoque, Armário, Maleta 1, Maleta 2 |
| Nome de pessoa | Consignada | 1 (implantação) | Consignado, com o nome em `consignado_com` |
| VENDIDO | Vendida, com ou sem data de venda. Sem data, não gera histórico de venda nem ocorrência de revisão | 0 | — |
| "sumiu" | Perdida | 0 | — |
| Vazio | A revisar (a confirmar) | 0 | — |

- **RN-96 Venda prevalece.** Uma linha com data de venda válida é tratada como vendida, qualquer que seja o local (11 casos observados com local diferente de VENDIDO). A divergência fica registrada para revisão.
- **RN-97 Implantação.** Cada peça com saldo 1 recebe uma movimentação `IMPLANTACAO`, com custo unitário igual ao valor de aquisição (vazio no CLS) e data da ocorrência igual à data da importação. Peças com saldo 0 não recebem movimentação.
- **RN-98 Origem.** Toda peça importada guarda o arquivo, a aba e a linha de origem, o local original, o tamanho original e a situação original (tabela `produto_origem`).
- **RN-99 Histórico de vendas.** Cada linha com data de venda válida gera um registro em `venda_historica`: data, valor de venda (pode estar vazio) e valor de compra. Valor de R$ 0,01 é marcado como **simbólico** e não entra no faturamento. Esses registros **não** são vendas da aplicação: não têm número de venda, não entram em ticket médio nem em associação e não são cancelados. O nome do cliente **nunca** é importado. Data de venda inválida (1 caso observado) leva a linha para a lista de revisão.
- **RN-100 Perdas da planilha.** Peças "sumiu" ficam registradas em `produto_origem` com a situação PERDIDA, sem movimentação: a data da perda é desconhecida e não é inventada.

### 6.3 Execução e auditoria

- **RN-101** O comando recusa a execução se já houver qualquer produto no banco. Repetir a importação exige um banco recriado, com confirmação explícita do usuário.
- **RN-102** Tudo numa única transação: ou a importação inteira entra, ou nada entra.
- **RN-103** Cada execução gera um lote (`importacao_lote`) com início, fim, arquivo e contagens por aba: linhas lidas, peças importadas, vendas históricas e rejeições. Cada rejeição ou pendência de revisão (`importacao_ocorrencia`) guarda aba, linha, motivo e o código, **sem** descrição, cliente nem nome de pessoa.
- **RN-104** O relatório do comando no terminal mostra só contagens e motivos agrupados. Nenhum nome de pessoa aparece em log, terminal ou auditoria.
- **RN-105** Critério de aceite: lidas = importadas + rejeitadas para cada aba e para o CLS; a soma dos saldos é igual ao número de peças em estoque e consignadas; o invariante I2 vale para todas as peças.

### 6.4 Tabelas novas

```sql
alter table app.produto
  add column indice_preco    numeric(14,4) check (indice_preco > 0),
  add column valor_aquisicao numeric(14,2) check (valor_aquisicao >= 0),
  add column data_aquisicao  date,
  add column local_estoque  text check (local_estoque in ('Estoque', 'Armário', 'Maleta 1', 'Maleta 2', 'Consignado')),
  add column consignado_com text,
  add check ((local_estoque = 'Consignado') = (consignado_com is not null));

create table app.importacao_lote (
  id            bigint generated always as identity primary key,
  arquivo       text not null,
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  usuario_id    bigint not null references app.usuario,
  contagens     jsonb not null default '{}'
);

create table app.importacao_ocorrencia (
  id       bigint generated always as identity primary key,
  lote_id  bigint not null references app.importacao_lote,
  aba      text not null,
  linha    integer not null,
  codigo   text,
  tipo     text not null check (tipo in ('REJEITADA', 'REVISAR')),
  motivo   text not null
);

create table app.produto_origem (
  produto_id        bigint primary key references app.produto,
  lote_id           bigint not null references app.importacao_lote,
  aba               text not null,
  linha             integer not null,
  arquivo           text not null,
  local_original    text,
  tamanho_original  text,
  situacao_original text not null check (situacao_original in ('EM_ESTOQUE', 'CONSIGNADA', 'VENDIDA', 'PERDIDA', 'REVISAR'))
);

create table app.preco_ouro (
  id               bigint generated always as identity primary key,
  valor_grama      numeric(14,2) not null check (valor_grama > 0),
  vigente_desde    date not null,
  registrado_em    timestamptz not null default now(),
  registrado_por   bigint not null references app.usuario
);

create table app.venda_historica (
  id            bigint generated always as identity primary key,
  produto_id    bigint not null references app.produto,
  lote_id       bigint not null references app.importacao_lote,
  data_venda    date not null,
  valor_venda   numeric(14,2) check (valor_venda >= 0),
  valor_compra  numeric(14,2) check (valor_compra >= 0),
  simbolico     boolean not null default false
);
```

`preco_ouro` é imutável (gatilho que recusa UPDATE e DELETE). Um gatilho em `produto` recusa `tamanho` preenchido quando a categoria não usa tamanho, e `data_aquisicao` futura. A função `app.preco_sugerido(produto_id, data)` implementa RN-68.

`local_original` guarda o texto da planilha e pode conter nome de pessoa: é dado pessoal, lido só pela aplicação e **nunca** exportado ao DW. `local_estoque` e `consignado_com` podem ser alterados pelo administrador na edição do produto, com auditoria. Transferência entre locais como movimentação fica fora do escopo.

### 6.5 Leitura dos arquivos

O comando `npm run importar:planilhas -- <caminho do XLSX>` lê o arquivo com a biblioteca ExcelJS, dentro de `web/` [decisão E9]. Os testes usam uma planilha de teste gerada pelo próprio teste, com linhas inventadas que reproduzem cada caso das regras RN-90 a RN-100; a planilha real nunca vai para o repositório nem para os testes.

## 6A. Papel de leitura para o DW

Papel `nobreza_leitura_dw`, somente SELECT nas tabelas de `app` e EXECUTE em `app.preco_sugerido`, **exceto** as colunas `consignado_com` e `local_original` e as tabelas de usuário, sessão e auditoria. É usado pelo ETL do DW real. A exclusão por coluna garante que nenhum nome de pessoa chega ao relatório público.

## 7. Testes

| Nível | Alvo | Onde roda |
|---|---|---|
| Unitário | Validação de entrada, permissões, tradução de erros | Sem banco |
| Integração | Migrations, privilégios do papel da aplicação, funções de estoque, invariantes I1 a I10, concorrência (RN-31, RN-43) | `nobreza_app_teste` |
| Ponta a ponta | Login e fluxo de venda, se o prazo permitir | Aplicação em execução |

Os dados dos testes são inventados e criados pelo próprio teste ("dados de teste"); dado real nunca entra nos testes. Os testes de integração recriam o esquema `app` do banco de teste. A rotina recusa a execução se o nome do banco não terminar em `_teste`. Os testes rodam a aplicação com o papel `nobreza_aplicacao`, e não com o dono do esquema, para que os privilégios também sejam testados.

## 8. Fora do escopo

Clientes, fornecedores, financeiro, fotos, comprovantes, exportação, recuperação de senha por e-mail, transferência entre locais como movimentação, preço por índice, agrupamento por modelo, forma de pagamento, desconto sobre o total, devolução e troca, cancelamento parcial, gestão de tipos de movimentação pela interface, exclusão física, modo offline e hospedagem. Na primeira versão também ficam fora as compras e as consultas operacionais (E10).
