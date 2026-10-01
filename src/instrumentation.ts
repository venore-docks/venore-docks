import type { Instrumentation } from "next";

// Erros não tratados do servidor -> log operacional + ERROR_WEBHOOK_URL opcional
// (platform/error-reporting/report-request-error.ts). Import dinâmico e só no runtime Node: o
// módulo puxa o banco/observability, que não existem no Edge.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("@/platform/error-reporting/report-request-error");
  await reportRequestError(error, { path: request.path, method: request.method }, {
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
