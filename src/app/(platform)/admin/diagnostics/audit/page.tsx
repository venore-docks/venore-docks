import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { listAuditEvents } from "@/observability";
import type { EventOutcome } from "@/observability";
import { getDiagnosticsAuditPageData } from "@/platform/admin-shell/get-diagnostics-audit-page-data";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

type AuditSearchParams = {
  actorId?: string;
  outcome?: string;
  cursor?: string;
};

function parseOutcome(value: string | undefined): EventOutcome | undefined {
  return value === "success" || value === "failure" ? value : undefined;
}

function buildLoadMoreHref(searchParams: AuditSearchParams, cursor: string): string {
  const params = new URLSearchParams();
  if (searchParams.actorId) params.set("actorId", searchParams.actorId);
  if (searchParams.outcome) params.set("outcome", searchParams.outcome);
  params.set("cursor", cursor);
  return `/admin/diagnostics/audit?${params.toString()}`;
}

// Só leitura — não existe botão de limpar/expurgo aqui (decisão da FASE 1: auditoria de segurança
// não é apagável por ação de admin, sobrevive inclusive à limpeza do log operacional).
export default async function DiagnosticsAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  const gate = await getDiagnosticsAuditPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para ver a auditoria de segurança.</p>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const result = await listAuditEvents({
    actorId: resolvedSearchParams.actorId || undefined,
    outcome: parseOutcome(resolvedSearchParams.outcome),
    cursor: resolvedSearchParams.cursor,
  });

  if (!result.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar a auditoria agora. Tente recarregar a página.</p>;
  }

  const { entries, hasMore } = result.data;
  const lastEntry = entries[entries.length - 1];

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/diagnostics">
            <ArrowLeft className="size-4" />
            Diagnóstico
          </Link>
        </Button>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Auditoria de segurança</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ações administrativas privilegiadas. Trilha permanente — não é afetada pela limpeza do log operacional.
        </p>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        {entries.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-8" strokeWidth={1.5} />}
            title="Nenhum evento de auditoria encontrado"
            description="Ações privilegiadas (conceder superadmin, alterar permissions, aprovar cadastro, limpar log) aparecem aqui."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/56">
                    <span className="whitespace-nowrap">{formatDate(entry.occurredAt, DEFAULT_DATE_LOCALE, "dateTimeSeconds")}</span>
                    <Badge variant={entry.outcome === "success" ? "secondary" : "destructive"}>
                      {entry.outcome === "success" ? "sucesso" : "falha"}
                    </Badge>
                    {entry.actorId && (
                      <span>
                        {entry.actorType}:{entry.actorId}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{entry.summary}</p>
                  {entry.detail && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        Detalhes técnicos
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-sm bg-muted p-3 text-xs text-muted-foreground">
                        {JSON.stringify(entry.detail, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>

            {hasMore && lastEntry && (
              <div className="mt-4 text-center">
                <Link
                  href={buildLoadMoreHref(resolvedSearchParams, lastEntry.id)}
                  className="rounded-sm text-sm font-medium text-foreground outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Carregar mais
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
