# Guia de conexão do Power BI ao DW demonstrativo

> **AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.**

**Status:** guia preparado. O Power BI Desktop **já está instalado** pelo usuário, mas a **conexão e as medidas ainda não foram validadas**. O banco `dw_joalheria` ainda não foi criado nem carregado.

## Pré-requisitos
1. PostgreSQL 18.6 local com o banco criado e carregado:
   - `scripts/criar_banco.ps1`
   - `scripts/run_migrations.ps1`
   - `scripts/run_demo_etl.ps1`
   - `scripts/run_tests.ps1` sem falhas.
2. Power BI Desktop (já instalado). As versões recentes já incluem o conector PostgreSQL; se for solicitado um provedor, siga a orientação exibida pelo próprio Power BI.
3. Um usuário de banco com permissão de leitura em `bi_demo`. Recomenda-se criar um usuário somente leitura, por decisão do usuário (ver `docs/pending_questions.md`).

## Conexão
1. **Obter dados → Banco de dados PostgreSQL.**
2. **Servidor:** `localhost:5432` (ou `PGHOST:PGPORT` do `.env`). **Banco de dados:** `dw_joalheria`.
3. **Modo de conectividade:** **Importar**.
4. **Credenciais:** autenticação de banco de dados. Não salve a senha em arquivos versionados.
5. No navegador, selecione **somente as views da schema `bi_demo`**:

| View | Nome sugerido no modelo |
|---|---|
| `bi_demo.vw_dim_produto` | `dim_produto` |
| `bi_demo.vw_dim_data` | `dim_data` |
| `bi_demo.vw_dim_tipo_movimentacao` | `dim_tipo_movimentacao` |
| `bi_demo.vw_fato_compra_item` | `fato_compra_item` |
| `bi_demo.vw_fato_venda_item` | `fato_venda_item` |
| `bi_demo.vw_fato_movimentacao_estoque` | `fato_movimentacao_estoque` |
| `bi_demo.vw_fato_snapshot_estoque` | `fato_snapshot_estoque` |
| `bi_demo.vw_preco_ouro` | `preco_ouro` |
| `bi_demo.vw_associacao_tipos` | `associacao_tipos` |
| `bi_demo.vw_associacao_produtos` | `associacao_produtos` |
| `bi_demo.vw_info_ambiente` | `info_ambiente` |

Não importe tabelas de `staging_demo`, `config_demo` ou `audit_demo`, nem tabelas de `dw_demo` diretamente. O consumo é sempre pelas views.

## Parâmetro de ambiente (preparação para a fase 2)
- Crie o parâmetro **`Esquema`** (texto) com o valor `bi_demo`.
- No Editor do Power Query, substitua o nome fixo da schema pelo parâmetro em cada consulta, por exemplo `Fonte{[Schema=Esquema, Item="vw_dim_produto"]}[Data]`.
- Na fase 2, as views reais terão os **mesmos nomes de colunas** em uma schema própria. A troca de ambiente será feita apenas pelo parâmetro. **Nunca** combine (append) dados demo e reais.

## Atualização
- **Atualizar** no Power BI Desktop relê as views.
- Antes de atualizar, rode `scripts/run_demo_etl.ps1`. Ele é idempotente: sem mudança de configuração, nada muda.

## Segurança
- **Não versionar:** `.pbix`, que já está no `.gitignore`, nem credenciais.
- O arquivo PBIX só deve ser declarado funcional após a validação de `powerbi/validation_checklist.md`.
