-- T02 — privilégios das tabelas e funções novas (especificação, seções 4.1 e 6A).
-- Requer o papel nobreza_leitura_dw, criado por db/bootstrap/02_criar_papel_leitura_dw.sql.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nobreza_leitura_dw') then
    raise exception 'O papel nobreza_leitura_dw não existe. Execute db/bootstrap/02_criar_papel_leitura_dw.sql antes das migrations.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- nobreza_aplicacao. SELECT nas tabelas novas já vem do privilégio padrão da
-- migration 0004. Venda, item de venda, movimentação e saldo: só leitura (E1).
-- ---------------------------------------------------------------------------
grant insert, update on app.produto     to nobreza_aplicacao;
grant insert, update on app.compra      to nobreza_aplicacao;
grant insert, update on app.compra_item to nobreza_aplicacao;
grant insert         on app.preco_ouro  to nobreza_aplicacao;

-- Funções: por padrão o PostgreSQL dá EXECUTE a todos; aqui só quem precisa.
revoke execute on function app._movimentar(bigint, text, integer, date, text, numeric, bigint, bigint, bigint, bigint) from public;
revoke execute on function app._exigir_perfil(bigint, text[]) from public;
revoke execute on function app.movimentar_manual(bigint, text, integer, date, text, numeric, bigint) from public;
revoke execute on function app.importar_lote(bigint, text, jsonb, jsonb) from public;
revoke execute on function app.preco_ouro_vigente(date) from public;
revoke execute on function app.preco_sugerido(bigint, date) from public;
revoke execute on function app.recusar_alteracao() from public;
revoke execute on function app.proteger_compra_item() from public;
revoke execute on function app.validar_produto() from public;
revoke execute on function app.validar_categoria_tamanho() from public;

grant execute on function app.movimentar_manual(bigint, text, integer, date, text, numeric, bigint) to nobreza_aplicacao;
grant execute on function app.importar_lote(bigint, text, jsonb, jsonb) to nobreza_aplicacao;
grant execute on function app.preco_ouro_vigente(date) to nobreza_aplicacao;
grant execute on function app.preco_sugerido(bigint, date) to nobreza_aplicacao;

-- ---------------------------------------------------------------------------
-- nobreza_leitura_dw (seção 6A): só leitura, sem nomes de pessoas. Fica de fora
-- consignado_com, local_original e as tabelas de usuário, sessão e auditoria.
-- ---------------------------------------------------------------------------
grant usage on schema app to nobreza_leitura_dw;

grant select on
  app.material, app.categoria, app.subcategoria, app.saldo_estoque, app.tipo_movimentacao,
  app.venda, app.venda_item, app.compra, app.compra_item, app.movimentacao_estoque,
  app.configuracao, app.importacao_lote, app.importacao_ocorrencia, app.preco_ouro,
  app.venda_historica
  to nobreza_leitura_dw;

grant select (id, codigo, descricao, material_id, categoria_id, subcategoria_id, modo_controle,
              peso_gramas, tamanho, pedras, preco_venda, estoque_minimo, observacao,
              indice_preco, valor_aquisicao, data_aquisicao, local_estoque, ativo,
              criado_em, atualizado_em)
  on app.produto to nobreza_leitura_dw;

grant select (produto_id, lote_id, aba, linha, arquivo, tamanho_original, situacao_original)
  on app.produto_origem to nobreza_leitura_dw;

grant execute on function app.preco_ouro_vigente(date) to nobreza_leitura_dw;
grant execute on function app.preco_sugerido(bigint, date) to nobreza_leitura_dw;
