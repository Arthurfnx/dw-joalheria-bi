"use client";

import { acaoEntrar } from "@/app/acoes/acesso";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, GrupoCampo } from "@/componentes/ui";

export function FormularioLogin() {
  return (
    <Cartao>
      <FormularioAcao acao={acaoEntrar} rotuloBotao="Entrar" className="[&_button[type=submit]]:w-full">
        <GrupoCampo rotulo="Login" htmlFor="login">
          <Campo id="login" name="login" autoComplete="username" autoCapitalize="none" required autoFocus />
        </GrupoCampo>
        <GrupoCampo rotulo="Senha" htmlFor="senha">
          <Campo id="senha" name="senha" type="password" autoComplete="current-password" required />
        </GrupoCampo>
      </FormularioAcao>
    </Cartao>
  );
}
