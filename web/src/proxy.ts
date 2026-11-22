// Barreira inicial: sem cookie de sessão, qualquer rota protegida leva ao
// login. É só uma checagem otimista; a validação real da sessão e do perfil
// é feita no servidor por cada tela e cada operação.

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESSAO = "nj_sessao";
const ROTAS_PUBLICAS = new Set(["/login"]);

export function proxy(requisicao: NextRequest) {
  const { pathname } = requisicao.nextUrl;
  if (ROTAS_PUBLICAS.has(pathname)) return NextResponse.next();
  if (!requisicao.cookies.has(COOKIE_SESSAO)) {
    return NextResponse.redirect(new URL("/login", requisicao.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
