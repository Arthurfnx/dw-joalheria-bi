import type { Metadata } from "next";
import {
  acaoCriarUsuario,
  acaoDesativarUsuario,
  acaoEditarUsuario,
  acaoReativarUsuario,
  acaoRedefinirSenha,
} from "@/app/acoes/administracao";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, Etiqueta, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { TAMANHO_MINIMO_SENHA } from "@/servidor/seguranca/senha";
import { listarUsuarios } from "@/servidor/servicos/usuarios";
import { formatarDataHora } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Usuários" };

function OpcoesPerfil() {
  return (
    <>
      <option value="VENDEDOR">Vendedor</option>
      <option value="ADMINISTRADOR">Administrador</option>
    </>
  );
}

export default async function PaginaUsuarios() {
  const ator = await exigirAcessoRota("/admin/usuarios");
  const usuarios = await listarUsuarios(bdAplicacao(), ator);

  return (
    <>
      <TituloPagina descricao="O login não muda depois de criado. Usuários não são apagados: são desativados.">
        Usuários
      </TituloPagina>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Cartao className="h-fit">
          <h2 className="mb-3 font-semibold">Novo usuário</h2>
          <FormularioAcao acao={acaoCriarUsuario} rotuloBotao="Criar usuário">
            <GrupoCampo rotulo="Nome" htmlFor="novo-nome">
              <Campo id="novo-nome" name="nome" required maxLength={120} />
            </GrupoCampo>
            <GrupoCampo rotulo="Login" htmlFor="novo-login">
              <Campo
                id="novo-login"
                name="login"
                required
                autoCapitalize="none"
                pattern="[a-z0-9._\-]{3,40}"
                title="De 3 a 40 caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado"
              />
            </GrupoCampo>
            <GrupoCampo rotulo="Perfil" htmlFor="novo-perfil">
              <Selecao id="novo-perfil" name="perfil" defaultValue="VENDEDOR">
                <OpcoesPerfil />
              </Selecao>
            </GrupoCampo>
            <GrupoCampo rotulo={`Senha provisória (mínimo de ${TAMANHO_MINIMO_SENHA} caracteres)`} htmlFor="novo-senha">
              <Campo
                id="novo-senha"
                name="senha"
                type="password"
                autoComplete="new-password"
                minLength={TAMANHO_MINIMO_SENHA}
                required
              />
            </GrupoCampo>
          </FormularioAcao>
        </Cartao>

        <ul className="space-y-3">
          {usuarios.map((u) => (
            <li key={u.id}>
              <Cartao>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{u.nome}</p>
                    <p className="text-sm break-all text-texto-suave">
                      {u.login} · {u.perfil === "ADMINISTRADOR" ? "Administrador" : "Vendedor"}
                    </p>
                    <p className="text-xs text-texto-suave">Criado em {formatarDataHora(u.criadoEm)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Etiqueta ativo={u.ativo}>{u.ativo ? "Ativo" : "Inativo"}</Etiqueta>
                    {u.deveTrocarSenha ? <Etiqueta ativo={false}>Troca de senha pendente</Etiqueta> : null}
                    {u.bloqueado ? <Etiqueta ativo={false}>Bloqueado temporariamente</Etiqueta> : null}
                  </div>
                </div>

                <details className="mt-3 border-t border-borda pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primaria">Gerenciar</summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-3">
                    <FormularioAcao acao={acaoEditarUsuario} rotuloBotao="Salvar" varianteBotao="secundario">
                      <input type="hidden" name="id" value={u.id} />
                      <GrupoCampo rotulo="Nome" htmlFor={`nome-${u.id}`}>
                        <Campo id={`nome-${u.id}`} name="nome" defaultValue={u.nome} required maxLength={120} />
                      </GrupoCampo>
                      <GrupoCampo rotulo="Perfil" htmlFor={`perfil-${u.id}`}>
                        <Selecao id={`perfil-${u.id}`} name="perfil" defaultValue={u.perfil}>
                          <OpcoesPerfil />
                        </Selecao>
                      </GrupoCampo>
                    </FormularioAcao>

                    <FormularioAcao
                      acao={acaoRedefinirSenha}
                      rotuloBotao="Redefinir senha"
                      varianteBotao="secundario"
                      confirmar={`Redefinir a senha de ${u.nome}? As sessões abertas dele serão encerradas.`}
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <GrupoCampo rotulo="Nova senha provisória" htmlFor={`senha-${u.id}`}>
                        <Campo
                          id={`senha-${u.id}`}
                          name="senha"
                          type="password"
                          autoComplete="new-password"
                          minLength={TAMANHO_MINIMO_SENHA}
                          required
                        />
                      </GrupoCampo>
                    </FormularioAcao>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Situação</p>
                      {u.ativo ? (
                        <FormularioAcao
                          acao={acaoDesativarUsuario}
                          rotuloBotao="Desativar"
                          varianteBotao="perigo"
                          confirmar={`Desativar ${u.nome}? Ele perde o acesso imediatamente.`}
                        >
                          <input type="hidden" name="id" value={u.id} />
                        </FormularioAcao>
                      ) : (
                        <FormularioAcao acao={acaoReativarUsuario} rotuloBotao="Reativar" varianteBotao="secundario">
                          <input type="hidden" name="id" value={u.id} />
                        </FormularioAcao>
                      )}
                    </div>
                  </div>
                </details>
              </Cartao>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
