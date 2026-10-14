import { NextResponse, type NextRequest } from "next/server";
import { issueSafeModeToken } from "@/platform/theme-engine/theme-config";
import { THEME_PREVIEW_COOKIE, themeOverrideCookieOptions } from "@/platform/theme-preview/override-token";

// Safe mode do tema (spec §7.2, runbook em docs/themes/theme-system-v8.md §20): `?on=1` força o
// venore-slime SÓ para o admin que chamou (cookie assinado com o id dele, ≤ 2 h); `?on=0` limpa o
// override de tema deste navegador (safe mode ou preview de rascunho). Rota de core — quem
// assina é o servidor depois de autorizar settings.manage, nunca o proxy.
export const dynamic = "force-dynamic";

function safeNextPath(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get("next");
  // Só caminho relativo do próprio site (sem "//host", sem esquema) — evita open redirect.
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/admin/themes";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // GET por exigência do runbook (link colável na barra de endereço). Navegação vinda de outro
  // site não liga nem desliga nada.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Requisição de outro site recusada." }, { status: 403 });
  }

  const on = request.nextUrl.searchParams.get("on");
  if (on !== "1" && on !== "0") {
    return NextResponse.json({ error: 'Use "?on=1" para ligar ou "?on=0" para desligar o modo seguro.' }, { status: 400 });
  }

  const redirectTo = new URL(safeNextPath(request), request.nextUrl.origin);
  if (on === "0") {
    const response = NextResponse.redirect(redirectTo, 303);
    response.cookies.delete(THEME_PREVIEW_COOKIE);
    return response;
  }

  const issued = await issueSafeModeToken();
  if (!issued.success) {
    const status = issued.error.code === "rbac.authorization.unauthenticated" ? 401 : issued.error.code.startsWith("rbac.") ? 403 : 503;
    return NextResponse.json({ error: issued.error.message, code: issued.error.code }, { status });
  }
  const response = NextResponse.redirect(redirectTo, 303);
  response.cookies.set(THEME_PREVIEW_COOKIE, issued.data.token, themeOverrideCookieOptions());
  return response;
}
