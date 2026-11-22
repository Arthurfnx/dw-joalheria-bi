-- T01 — cadastros de domínio: material, categoria e subcategoria (RN-10, RN-11).

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
  -- Alvo da chave estrangeira composta de produto (T02): a subcategoria do
  -- produto tem de pertencer à categoria do produto.
  unique (id, categoria_id)
);
create unique index subcategoria_nome_uk on app.subcategoria (categoria_id, lower(nome));
