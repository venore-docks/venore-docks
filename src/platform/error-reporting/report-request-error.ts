import { beginOperation, endOperation } from "@/observability";

export type RequestErrorInfo = { path: string; method: string };
export type RequestErrorContext = { routePath: string; routeType: string };

// Controle de fluxo do Next (redirect, notFound, forbidden...) chega aqui como "erro" — não é.
const CONTROL_FLOW_DIGEST = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

function describe(error: unknown): { message: string; digest: string | null; stack: string | null } {
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 8).join("\n") : null;
  return { message: message.slice(0, 500), digest, stack };
}

// Erro não tratado no servidor (render, route handler, Server Action, proxy) — chamado por
// src/instrumentation.ts. Vai pro log operacional (aparece em /admin/diagnostics) e, se
// ERROR_WEBHOOK_URL estiver definido, é enviado em JSON pra lá (ex: um endpoint do Slack/Discord
// ou de um serviço de erros). Nunca lança: reportar erro não pode gerar outro erro.
export async function reportRequestError(error: unknown, request: RequestErrorInfo, context: RequestErrorContext): Promise<void> {
  const { message, digest, stack } = describe(error);
  if (digest && CONTROL_FLOW_DIGEST.test(digest)) return;

  try {
    const handle = beginOperation({
      useCase: "platform.unhandled-request-error",
      actor: { id: "server", type: "system" },
      kind: "write",
    });
    endOperation(handle, {
      success: false,
      error: { code: "unhandled", message: `${request.method} ${request.path} (${context.routeType} ${context.routePath}): ${message}` },
    });
  } catch {
    // log indisponível — segue pro webhook
  }

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Erro no servidor: ${request.method} ${request.path} — ${message}`,
        message,
        digest,
        stack,
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // webhook fora do ar: o log operacional já registrou
  }
}
