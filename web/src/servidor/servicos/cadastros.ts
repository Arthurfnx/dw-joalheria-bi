// Cadastros de domínio: material, categoria e subcategoria (RN-10, RN-11).
// Não há exclusão física (E3): itens são desativados e reativados.

import type { Bd, Trx } from "../bd/conexao";
import { registrarAuditoria } from "../auditoria";
import { ErroNaoEncontrado, ErroNegocio, ehViolacaoDeUnicidade, traduzirErroBanco } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { esquemaId, esquemaNomeCadastro, validar } from "../validacao";
import { z } from "zod";

export type TipoCadastro = "material" | "categoria" | "subcategoria";

const TABELA = {
  material: "app.material",
  categoria: "app.categoria",
  subcategoria: "app.subcategoria",
} as const;

const ROTULO: Record<TipoCadastro, { duplicado: string; naoEncontrado: string }> = {
  material: {
    duplicado: "Já existe um material com este nome.",
    naoEncontrado: "Material não encontrado.",
  },
  categoria: {
    duplicado: "Já existe uma categoria com este nome.",
    naoEncontrado: "Categoria não encontrada.",
  },
  subcategoria: {
    duplicado: "Já existe uma subcategoria com este nome nesta categoria.",
    naoEncontrado: "Subcategoria não encontrada.",
  },
};

export interface ItemCadastro {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface ItemCategoria extends ItemCadastro {
  usaTamanho: boolean;
}

export interface ItemSubcategoria extends ItemCadastro {
  categoriaId: string;
  categoriaNome: string;
}

const esquemaTipo = z.enum(["material", "categoria", "subcategoria"], { error: "Cadastro inválido." });

const esquemaCriar = z.object({
  tipo: esquemaTipo,
  nome: esquemaNomeCadastro,
  categoriaId: esquemaId.optional(),
  usaTamanho: z.boolean().optional(),
});
const esquemaRenomear = z.object({ tipo: esquemaTipo, id: esquemaId, nome: esquemaNomeCadastro });
const esquemaSituacao = z.object({ tipo: esquemaTipo, id: esquemaId, ativo: z.boolean() });

/** RN-10: o nome é único sem diferenciar maiúsculas; o índice único em lower(nome) é a garantia final. */
async function comTraducaoDeDuplicidade<T>(tipo: TipoCadastro, operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) throw new ErroNegocio(ROTULO[tipo].duplicado);
    throw erro;
  }
}

async function carregar(trx: Trx, tipo: TipoCadastro, id: string) {
  const item =
    tipo === "subcategoria"
      ? await trx
          .selectFrom("app.subcategoria")
          .select(["id", "nome", "ativo", "categoria_id"])
          .where("id", "=", id)
          .forUpdate()
          .executeTakeFirst()
      : await trx.selectFrom(TABELA[tipo]).select(["id", "nome", "ativo"]).where("id", "=", id).forUpdate().executeTakeFirst();
  if (!item) throw new ErroNaoEncontrado(ROTULO[tipo].naoEncontrado);
  return item;
}

export async function criarCadastro(bd: Bd, ator: Ator, entrada: unknown): Promise<string> {
  exigirPermissao(ator, "cadastros.gerenciar");
  const dados = validar(esquemaCriar, entrada);

  return bd.transaction().execute(async (trx) => {
    let criado: Record<string, unknown> & { id: string };
    if (dados.tipo === "subcategoria") {
      if (!dados.categoriaId) throw new ErroNegocio("Escolha a categoria da subcategoria.");
      // RN-11: uma categoria desativada não recebe subcategorias novas.
      const categoria = await trx
        .selectFrom("app.categoria")
        .select(["id", "ativo"])
        .where("id", "=", dados.categoriaId)
        .executeTakeFirst();
      if (!categoria || !categoria.ativo) throw new ErroNegocio("Categoria inexistente ou inativa.");
      criado = await comTraducaoDeDuplicidade("subcategoria", () =>
        trx
          .insertInto("app.subcategoria")
          .values({ nome: dados.nome, categoria_id: categoria.id })
          .returning(["id", "nome", "ativo", "categoria_id"])
          .executeTakeFirstOrThrow(),
      );
    } else {
      const tabela = TABELA[dados.tipo];
      criado = await comTraducaoDeDuplicidade(dados.tipo, () =>
        dados.tipo === "categoria"
          ? trx
              .insertInto("app.categoria")
              .values({ nome: dados.nome, usa_tamanho: dados.usaTamanho ?? false })
              .returning(["id", "nome", "ativo", "usa_tamanho"])
              .executeTakeFirstOrThrow()
          : trx.insertInto(tabela).values({ nome: dados.nome }).returning(["id", "nome", "ativo"]).executeTakeFirstOrThrow(),
      );
    }
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "CRIAR",
      entidade: dados.tipo,
      entidadeId: criado.id,
      depois: criado,
    });
    return criado.id;
  });
}

export async function renomearCadastro(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "cadastros.gerenciar");
  const dados = validar(esquemaRenomear, entrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregar(trx, dados.tipo, dados.id);
    const depois = await comTraducaoDeDuplicidade(dados.tipo, () =>
      trx
        .updateTable(TABELA[dados.tipo])
        .set({ nome: dados.nome })
        .where("id", "=", dados.id)
        .returning(["id", "nome", "ativo"])
        .executeTakeFirstOrThrow(),
    );
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: "ALTERAR",
      entidade: dados.tipo,
      entidadeId: dados.id,
      antes,
      depois,
    });
  });
}

/** RN-10 e RN-11: desativar tira o item das listas de escolha sem apagá-lo. */
export async function definirSituacaoCadastro(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "cadastros.gerenciar");
  const dados = validar(esquemaSituacao, entrada);
  await bd.transaction().execute(async (trx) => {
    const antes = await carregar(trx, dados.tipo, dados.id);
    if (antes.ativo === dados.ativo) {
      throw new ErroNegocio(dados.ativo ? "O item já está ativo." : "O item já está inativo.");
    }
    const depois = await trx
      .updateTable(TABELA[dados.tipo])
      .set({ ativo: dados.ativo })
      .where("id", "=", dados.id)
      .returning(["id", "nome", "ativo"])
      .executeTakeFirstOrThrow();
    await registrarAuditoria(trx, {
      usuarioId: ator.id,
      acao: dados.ativo ? "REATIVAR" : "DESATIVAR",
      entidade: dados.tipo,
      entidadeId: dados.id,
      antes,
      depois,
    });
  });
}

/** RN-21A: liga ou desliga o tamanho na categoria. O banco recusa desligar se houver produto com tamanho. */
export async function definirUsaTamanho(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "cadastros.gerenciar");
  const dados = validar(z.object({ id: esquemaId, usaTamanho: z.boolean() }), entrada);
  try {
    await bd.transaction().execute(async (trx) => {
      const antes = await trx
        .selectFrom("app.categoria")
        .select(["id", "nome", "usa_tamanho"])
        .where("id", "=", dados.id)
        .forUpdate()
        .executeTakeFirst();
      if (!antes) throw new ErroNaoEncontrado(ROTULO.categoria.naoEncontrado);
      const depois = await trx
        .updateTable("app.categoria")
        .set({ usa_tamanho: dados.usaTamanho })
        .where("id", "=", dados.id)
        .returning(["id", "nome", "usa_tamanho"])
        .executeTakeFirstOrThrow();
      await registrarAuditoria(trx, {
        usuarioId: ator.id,
        acao: "ALTERAR",
        entidade: "categoria",
        entidadeId: dados.id,
        antes,
        depois,
      });
    });
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
}

/** Lista completa para a tela de administração, com ativos e inativos. */
export async function listarCadastros(
  bd: Bd,
  ator: Ator,
): Promise<{ materiais: ItemCadastro[]; categorias: ItemCategoria[]; subcategorias: ItemSubcategoria[] }> {
  exigirPermissao(ator, "cadastros.gerenciar");
  const [materiais, categorias, subcategorias] = await Promise.all([
    bd.selectFrom("app.material").select(["id", "nome", "ativo"]).orderBy("ativo", "desc").orderBy("nome").execute(),
    bd
      .selectFrom("app.categoria")
      .select(["id", "nome", "ativo", "usa_tamanho as usaTamanho"])
      .orderBy("ativo", "desc")
      .orderBy("nome")
      .execute(),
    bd
      .selectFrom("app.subcategoria as s")
      .innerJoin("app.categoria as c", "c.id", "s.categoria_id")
      .select(["s.id", "s.nome", "s.ativo", "s.categoria_id as categoriaId", "c.nome as categoriaNome"])
      .orderBy("c.nome")
      .orderBy("s.ativo", "desc")
      .orderBy("s.nome")
      .execute(),
  ]);
  return { materiais, categorias, subcategorias };
}

/**
 * RN-11: opções para novos cadastros, só com itens ativos. Uma subcategoria
 * de categoria inativa também fica de fora. Usada pelos formulários desta
 * tarefa e pelo cadastro de produto (T02).
 */
export async function listarOpcoesDeCadastro(
  bd: Bd,
  ator: Ator,
): Promise<{ materiais: ItemCadastro[]; categorias: ItemCategoria[]; subcategorias: ItemSubcategoria[] }> {
  exigirPermissao(ator, "inicio.ver");
  const [materiais, categorias, subcategorias] = await Promise.all([
    bd.selectFrom("app.material").select(["id", "nome", "ativo"]).where("ativo", "=", true).orderBy("nome").execute(),
    bd
      .selectFrom("app.categoria")
      .select(["id", "nome", "ativo", "usa_tamanho as usaTamanho"])
      .where("ativo", "=", true)
      .orderBy("nome")
      .execute(),
    bd
      .selectFrom("app.subcategoria as s")
      .innerJoin("app.categoria as c", "c.id", "s.categoria_id")
      .select(["s.id", "s.nome", "s.ativo", "s.categoria_id as categoriaId", "c.nome as categoriaNome"])
      .where("s.ativo", "=", true)
      .where("c.ativo", "=", true)
      .orderBy("c.nome")
      .orderBy("s.nome")
      .execute(),
  ]);
  return { materiais, categorias, subcategorias };
}
