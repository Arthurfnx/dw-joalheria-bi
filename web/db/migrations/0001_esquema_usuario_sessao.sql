-- T01 — esquema da aplicação, usuários e sessões (especificação, seção 4.2).

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

-- Revogar todas as sessões de um usuário (RN-05) percorre este índice.
create index sessao_usuario_ix on app.sessao (usuario_id);
