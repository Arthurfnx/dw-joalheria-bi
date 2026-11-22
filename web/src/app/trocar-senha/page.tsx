import type { Metadata } from "next";
import Link from "next/link";
import { acaoTrocarSenha } from "@/app/acoes/acesso";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Aviso, Campo, Cartao, GrupoCampo } from "@/componentes/ui";
import { TAMANHO_MINIMO_SENHA } from "@/servidor/seguranca/senha";
import { exigirAtor } from "@/web/sessao";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function PaginaTrocarSenha() {
  // RN-04: única tela acessível enquanto a troca obrigatória estiver pendente.
  const ator = await exigirAtor({ permitirTrocaPendente: true });
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trocar senha</h1>
          <p className="text-sm text-texto-suave">{ator.nome}</p>
        </div>
        {ator.deveTrocarSenha ? (
          <Aviso tipo="alerta">Defina uma senha nova para continuar. Ela só é conhecida por você.</Aviso>
        ) : null}
        <Cartao>
          <FormularioAcao acao={acaoTrocarSenha} rotuloBotao="Salvar nova senha">
            <GrupoCampo rotulo="Senha atual" htmlFor="senhaAtual">
              <Campo id="senhaAtual" name="senhaAtual" type="password" autoComplete="current-password" required />
            </GrupoCampo>
            <GrupoCampo rotulo={`Nova senha (mínimo de ${TAMANHO_MINIMO_SENHA} caracteres)`} htmlFor="novaSenha">
              <Campo
                id="novaSenha"
                name="novaSenha"
                type="password"
                autoComplete="new-password"
                minLength={TAMANHO_MINIMO_SENHA}
                required
              />
            </GrupoCampo>
            <GrupoCampo rotulo="Confirme a nova senha" htmlFor="confirmacao">
              <Campo id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
            </GrupoCampo>
          </FormularioAcao>
        </Cartao>
        {ator.deveTrocarSenha ? null : (
          <Link href="/" className="block text-center text-sm text-primaria hover:underline">
            Voltar ao início
          </Link>
        )}
      </div>
    </main>
  );
}
