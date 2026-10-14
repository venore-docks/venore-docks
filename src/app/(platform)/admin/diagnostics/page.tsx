import Link from "next/link";
import { AlertTriangle, SearchX, ShieldCheck } from "lucide-react";
import { listEvents } from "@/observability";
import type { EventLevel, EventOutcome } from "@/observability";
import { canClearDiagnosticsEvents, getDiagnosticsPageData } from "@/platform/admin-shell/get-diagnostics-page-data";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LevelBadge } from "./_components/level-badge";
import { RefreshEventsButton } from "./_components/refresh-events-button";
import { ClearEventsButton } from "./_components/clear-events-button";
import { getErrorGuidance } from "./_components/error-guidance";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

type DiagnosticsSearchParams = {
  level?: string;
  outcome?: string;
  origin?: string;
  actorId?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

const LEVELS: EventLevel[] = ["info", "warn", "error", "critical"];

function parseLevel(value: string | undefined): EventLevel | undefined {
  return value && LEVELS.includes(value as EventLevel) ? (value as EventLevel) : undefined;
}

function parseOutcome(value: string | undefined): EventOutcome | undefined {
  return value === "success" || value === "failure" ? value : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildLoadMoreHref(searchParams: DiagnosticsSearchParams, cursor: string): string {
  const params = new URLSearchParams();
  if (searchParams.level) params.set("level", searchParams.level);
  if (searchParams.outcome) params.set("outcome", searchParams.outcome);
  if (searchParams.origin) params.set("origin", searchParams.origin);
  if (searchParams.actorId) params.set("actorId", searchParams.actorId);
  if (searchParams.from) params.set("from", searchParams.from);
  if (searchParams.to) params.set("to", searchParams.to);
  params.set("cursor", cursor);
  return `/admin/diagnostics?${params.toString()}`;
}

export default async function DiagnosticsAdminPage({
  searchParams,
}: {
  searchParams: Promise<DiagnosticsSearchParams>;
}) {
  const gate = await getDiagnosticsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para ver o diagnóstico do sistema.</p>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const level = parseLevel(resolvedSearchParams.level);
  const outcome = parseOutcome(resolvedSearchParams.outcome);
  const hasFilter = Boolean(
    resolvedSearchParams.level ||
      resolvedSearchParams.outcome ||
      resolvedSearchParams.origin ||
      resolvedSearchParams.actorId ||
      resolvedSearchParams.from ||
      resolvedSearchParams.to,
  );

  const result = await listEvents({
    level,
    outcome,
    origin: resolvedSearchParams.origin || undefined,
    actorId: resolvedSearchParams.actorId || undefined,
    from: parseDate(resolvedSearchParams.from),
    to: parseDate(resolvedSearchParams.to),
    cursor: resolvedSearchParams.cursor,
  });

  if (!result.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar o diagnóstico agora. Tente recarregar a página.</p>;
  }

  const { entries, hasMore } = result.data;
  const lastEntry = entries[entries.length - 1];
  const canClear = canClearDiagnosticsEvents(gate.actor);
  const canViewAudit = gate.actor.isSuperadmin || gate.actor.permissions.includes("observability.audit.view");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Diagnóstico</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log de eventos do site — o que aconteceu, quando e por quê.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canViewAudit && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/diagnostics/audit">
                <ShieldCheck className="size-4" />
                Auditoria de segurança
              </Link>
            </Button>
          )}
          <RefreshEventsButton />
          {canClear && <ClearEventsButton />}
        </div>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="level" className="text-xs font-medium text-muted-foreground">
              Nível
            </label>
            <Select name="level" defaultValue={resolvedSearchParams.level ?? "all"}>
              <SelectTrigger id="level" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Atenção</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="outcome" className="text-xs font-medium text-muted-foreground">
              Resultado
            </label>
            <Select name="outcome" defaultValue={resolvedSearchParams.outcome ?? "all"}>
              <SelectTrigger id="outcome" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failure">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="origin" className="text-xs font-medium text-muted-foreground">
              Origem
            </label>
            <Input id="origin" name="origin" type="text" defaultValue={resolvedSearchParams.origin ?? ""} placeholder="ex: context:rbac" className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="actorId" className="text-xs font-medium text-muted-foreground">
              Ator
            </label>
            <Input id="actorId" name="actorId" type="text" defaultValue={resolvedSearchParams.actorId ?? ""} placeholder="id do usuário" className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs font-medium text-muted-foreground">
              De
            </label>
            <Input id="from" name="from" type="datetime-local" defaultValue={resolvedSearchParams.from ?? ""} className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs font-medium text-muted-foreground">
              Até
            </label>
            <Input id="to" name="to" type="datetime-local" defaultValue={resolvedSearchParams.to ?? ""} className="w-48" />
          </div>
          <Button type="submit">Filtrar</Button>
        </form>
      </section>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        {entries.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-8" strokeWidth={1.5} />}
            title="Nenhum evento encontrado"
            description={
              hasFilter
                ? "Nenhum evento bate com os filtros escolhidos. Tente limpar algum dos filtros."
                : "Ainda não há eventos registrados — eles aparecem aqui assim que o sistema processar alguma ação."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {entries.map((entry) => {
                const isFailure = entry.outcome === "failure";
                return (
                  <li
                    key={entry.id}
                    className={
                      isFailure
                        ? "border-l-4 border-l-destructive bg-destructive/5 py-3 pl-3"
                        : "py-3 pl-3"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/56">
                      <span className="whitespace-nowrap">{formatDate(entry.occurredAt, DEFAULT_DATE_LOCALE, "dateTimeSeconds")}</span>
                      <LevelBadge level={entry.level} />
                      <span>{entry.origin}</span>
                      {entry.actorId && (
                        <span>
                          {entry.actorType}:{entry.actorId}
                        </span>
                      )}
                      <span>{entry.durationMs}ms</span>
                    </div>

                    <p className="mt-1 flex items-start gap-2 text-sm text-foreground">
                      {isFailure && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />}
                      <span>{entry.summary}</span>
                    </p>

                    {isFailure && (
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        <span className="font-medium text-destructive">O que fazer:</span> {getErrorGuidance(entry.errorCode)}
                      </p>
                    )}

                    {(entry.detail || entry.errorCode || entry.errorMessage) && (
                      <details className="mt-2 pl-6">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          Detalhes técnicos
                        </summary>
                        <div className="mt-2 space-y-1 rounded-sm bg-muted p-3 text-xs">
                          <p>
                            <span className="text-muted-foreground">Ação:</span> {entry.action}
                          </p>
                          {entry.errorCode && (
                            <p>
                              <span className="text-muted-foreground">Código:</span> {entry.errorCode}
                            </p>
                          )}
                          {entry.errorMessage && (
                            <p>
                              <span className="text-muted-foreground">Mensagem:</span> {entry.errorMessage}
                            </p>
                          )}
                          {entry.detail && (
                            <pre className="overflow-x-auto text-muted-foreground">{JSON.stringify(entry.detail, null, 2)}</pre>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
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
