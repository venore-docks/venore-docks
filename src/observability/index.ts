import { clearEventsHandler, countEventsHandler } from "./features/clear-events/handler";
import type { ActorRef } from "./contracts/types";
import type { ClearEventsResult } from "./features/clear-events/types";

export { beginOperation, endOperation } from "./operation-log";
export { recordAuditEvent } from "./audit-log";
// Agendador do core (platform/scheduled-jobs) — flush do buffer e retenção por período/volume.
export { flushNow as flushObservabilityBuffers } from "./flush";
export { runRetentionSweep as runObservabilityRetention } from "./retention";
export { observabilityAdminNavigationItems } from "./admin-navigation";
export { observabilityBreadcrumbSegments } from "./breadcrumbs";
export { listEventsHandler as listEvents } from "./features/list-events/handler";
export { listAuditEventsHandler as listAuditEvents } from "./features/list-audit-events/handler";

// Wrapper com nome de verbo de negócio (em vez de expor "clearEventsHandler" cru) — chamado só
// pelo ponto de composição platform/diagnostics-lifecycle/clear-diagnostics-events-safely.ts,
// nunca direto por um server action (mesmo motivo de deleteMediaSafely: authorizeActor mora fora
// de observability/, ver comentário lá).
export function clearDiagnosticsEvents(actor: ActorRef, confirmed: boolean): Promise<ClearEventsResult> {
  return clearEventsHandler(actor, confirmed);
}

export function countDiagnosticsEvents(): Promise<number> {
  return countEventsHandler();
}

export type {
  ActorRef,
  AuditEventInput,
  BeginOperationInput,
  EventLevel,
  EventOutcome,
  OperationHandle,
  OperationKind,
  OperationOutcome,
} from "./contracts/types";
export type { EventSummary, ListEventsQuery, ListEventsResult } from "./features/list-events/types";
export type {
  AuditEventSummary,
  ListAuditEventsQuery,
  ListAuditEventsResult,
} from "./features/list-audit-events/types";
export type { ClearEventsResult } from "./features/clear-events/types";
