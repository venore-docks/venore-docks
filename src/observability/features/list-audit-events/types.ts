import type { OperationResult } from "@/shared/types";
import type { EventOutcome } from "../../contracts/types";

export type ListAuditEventsQuery = {
  actorId?: string;
  // Filtra por `detail.targetUserId` — a maioria dos eventos privilegiados sobre uma conta (ver
  // auth.freeze-user, auth.remove-user, rbac.approve-registration etc.) grava o alvo aí, não como
  // actor. Usado pela aba de atividade do perfil admin (/admin/community/[userId]).
  targetUserId?: string;
  outcome?: EventOutcome;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

export type AuditEventSummary = {
  id: string;
  occurredAt: Date;
  action: string;
  actorId: string | null;
  actorType: string | null;
  outcome: EventOutcome;
  summary: string;
  detail: Record<string, unknown> | null;
};

export type ListAuditEventsResult = OperationResult<{ entries: AuditEventSummary[]; hasMore: boolean }>;
