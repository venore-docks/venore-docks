import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BREADCRUMB_PATHNAME_HEADER } from "@/platform/breadcrumbs/pathname-header";
import { buildCspHeaders, generateNonce, resolveCspMode } from "@/platform/security/content-security-policy";

// `middleware.ts` foi renomeado para `proxy.ts` no Next.js 16 (node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md — "Migration to Proxy"); mesmo arquivo, mesmo
// contrato, nome novo.
//
// Dois propósitos:
// 1. Expor a rota atual pra árvore de Server Components via header — só platform/breadcrumbs lê
//    (resolve-breadcrumbs.ts); usePathname() só existe em Client Component.
// 2. Content Security Policy com nonce por request (platform/security/content-security-policy.ts
//    — docs/content-security-policy.md do Next: nonce exige renderização dinâmica, que todas as
//    páginas já usam). O Next aplica o nonce nos próprios <script> lendo o header da request.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(BREADCRUMB_PATHNAME_HEADER, request.nextUrl.pathname);

  const nonce = generateNonce();
  const csp = buildCspHeaders(nonce, resolveCspMode(process.env.CSP_MODE), process.env.NODE_ENV === "development");
  for (const [name, value] of Object.entries(csp.request)) {
    requestHeaders.set(name, value);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(csp.response)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Exclui assets estáticos e rotas de API — breadcrumb e CSP só existem pra página renderizada
  // (docs/proxy.md — "Negative matching").
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
