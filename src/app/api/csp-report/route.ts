import { NextResponse } from "next/server";
import { checkRateLimitInMemory, getClientIp } from "@/infrastructure/rate-limit";
import { beginOperation, endOperation } from "@/observability";

// Recebe relatórios de violação de CSP (report-uri, platform/security/content-security-policy.ts)
// e registra como aviso no log operacional — aparece em /admin/diagnostics. Serve pra decidir
// quando dá pra trocar CSP_MODE de "report-only" pra "enforce" sem quebrar tema/plugin.
export const dynamic = "force-dynamic";

const REPORT_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const MAX_BODY_BYTES = 16 * 1024;

// Limite e deduplicação em memória do processo, sem ir ao banco: o relatório é best-effort e um
// INSERT no Postgres por violação (limitador + flush do log) dominava o CPU ativo da função.
const DEDUPE_TTL_MS = 10 * 60_000;
const MAX_DEDUPE_KEYS = 500;
const recentViolations = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const seenAt = recentViolations.get(key);
  if (seenAt !== undefined && now - seenAt < DEDUPE_TTL_MS) return true;
  if (recentViolations.size >= MAX_DEDUPE_KEYS) {
    for (const [k, at] of recentViolations) {
      if (now - at >= DEDUPE_TTL_MS) recentViolations.delete(k);
    }
    if (recentViolations.size >= MAX_DEDUPE_KEYS) recentViolations.clear();
  }
  recentViolations.set(key, now);
  return false;
}

type LegacyReport = { "csp-report"?: Record<string, unknown> };

function pick(report: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" && value.length > 0) return value.slice(0, 300);
  }
  return "";
}

export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimitInMemory(`csp-report:${getClientIp(request.headers)}`, REPORT_RATE_LIMIT);
  if (!limit.allowed) return new NextResponse(null, { status: 204 });

  const text = await request.text();
  if (text.length === 0 || text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Formato antigo (report-uri): { "csp-report": {...} }; Reporting API: [{ type, body }].
  const reports = Array.isArray(parsed)
    ? parsed.map((entry) => (entry as { body?: Record<string, unknown> }).body ?? {})
    : [((parsed as LegacyReport)["csp-report"] ?? {}) as Record<string, unknown>];

  for (const report of reports.slice(0, 10)) {
    const directive = pick(report, "effective-directive", "effectiveDirective", "violated-directive");
    const blocked = pick(report, "blocked-uri", "blockedURL");
    const documentUri = pick(report, "document-uri", "documentURL");
    if (isDuplicate(`${directive}|${blocked}|${documentUri}`)) continue;
    const handle = beginOperation({
      useCase: "platform.security.csp-violation",
      actor: { id: "browser", type: "system" },
      kind: "write",
    });
    endOperation(handle, {
      success: true,
      level: "warn",
      summary: `CSP bloquearia "${blocked || "inline"}" (${directive || "diretiva desconhecida"}) em ${documentUri || "página desconhecida"}.`,
      detail: { directive, blocked, documentUri },
    });
  }

  return new NextResponse(null, { status: 204 });
}
