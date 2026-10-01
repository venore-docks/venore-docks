// Content Security Policy do site (aplicada em src/proxy.ts a cada página renderizada).
//
// CSP_MODE:
//   "report-only" (default) — política completa só OBSERVA (violações vão pra /api/csp-report e
//     aparecem em /admin/diagnostics), sem quebrar tema/plugin que carregue recurso externo não
//     previsto. Recomendado até o log de violações ficar limpo.
//   "enforce" — política completa bloqueia de verdade.
//   "off"     — nenhuma política de conteúdo (só as proteções mínimas abaixo).
// Em QUALQUER modo, frame-ancestors/object-src/base-uri são sempre aplicados (clickjacking —
// frame-ancestors é ignorado em report-only, então vai num header CSP separado e enforced).
//
// FRAME_ANCESTORS: quem pode embutir o site num <iframe> (default 'self'). Ex:
//   FRAME_ANCESTORS="'self' https://intranet.exemplo.com"
export type CspMode = "enforce" | "report-only" | "off";

export const CSP_REPORT_PATH = "/api/csp-report";

export function resolveCspMode(raw: string | undefined): CspMode {
  if (raw === "enforce" || raw === "off") return raw;
  return "report-only";
}

function frameAncestors(): string {
  const configured = process.env.FRAME_ANCESTORS?.trim();
  // Só fontes de CSP simples — nada de `;` que abriria outra diretiva.
  if (configured && !configured.includes(";")) return configured;
  return "'self'";
}

export function buildBaselinePolicy(): string {
  return [`frame-ancestors ${frameAncestors()}`, "object-src 'none'", "base-uri 'self'"].join("; ");
}

export function buildContentPolicy(nonce: string, options: { isDev: boolean }): string {
  const directives = [
    "default-src 'self'",
    // strict-dynamic: scripts carregados pelos scripts com nonce (chunks do Next) herdam a
    // confiança; 'self' e https: são ignorados por navegadores com strict-dynamic e só valem de
    // fallback pra navegadores antigos.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' em estilo: atributos style="" (máscara do logo, paleta) não aceitam nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    // Upload direto pro Blob, sincronização de feed, push — destinos https externos.
    "connect-src 'self' https:" + (options.isDev ? " ws: wss:" : ""),
    // Plugins (ex: broadcast) embutem sites/vídeos.
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `frame-ancestors ${frameAncestors()}`,
    "object-src 'none'",
    "base-uri 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
  ];
  return directives.join("; ");
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export type CspHeaders = {
  // Vão na REQUEST (o Next lê o nonce daqui pra aplicar nos próprios <script>).
  request: Record<string, string>;
  // Vão na RESPONSE.
  response: Record<string, string>;
};

export function buildCspHeaders(nonce: string, mode: CspMode, isDev: boolean): CspHeaders {
  const baseline = buildBaselinePolicy();
  if (mode === "off") {
    return { request: {}, response: { "Content-Security-Policy": baseline } };
  }

  const content = buildContentPolicy(nonce, { isDev });
  if (mode === "enforce") {
    return {
      request: { "content-security-policy": content, "x-nonce": nonce },
      response: { "Content-Security-Policy": content },
    };
  }

  // Report-only: na request só o header report-only (o Next lê `content-security-policy`
  // primeiro — se o baseline fosse junto, o nonce nunca seria encontrado).
  return {
    request: { "content-security-policy-report-only": content, "x-nonce": nonce },
    response: { "Content-Security-Policy": baseline, "Content-Security-Policy-Report-Only": content },
  };
}
