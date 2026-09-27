import { peekBufferSizes, pushEvent, pushTraceEntry } from "./buffer";
import { getObservabilityConfig } from "./config";
import { flushNow, scheduleFlushAfterResponse } from "./flush";
import { inferOriginFromUseCase } from "./origin-registry";
import { redactDetail, redactText } from "./redaction";
import type {
  BeginOperationInput,
  EventLevel,
  OperationHandle,
  OperationOutcome,
} from "./contracts/types";

export function beginOperation(input: BeginOperationInput): OperationHandle {
  return {
    operationId: crypto.randomUUID(),
    useCase: input.useCase,
    actor: input.actor,
    kind: input.kind,
    origin: input.origin ?? inferOriginFromUseCase(input.useCase),
    startedAt: new Date(),
  };
}

function buildDefaultSummary(handle: OperationHandle, outcome: OperationOutcome): string {
  const actorPart = ` por ${handle.actor.type}:${handle.actor.id}`;
  if (outcome.success) {
    return `Ação "${handle.useCase}" concluída com sucesso${actorPart}.`;
  }
  return `Ação "${handle.useCase}" falhou${actorPart}: ${outcome.error.message}`;
}

function defaultLevel(outcome: OperationOutcome): EventLevel {
  return outcome.success ? "info" : "error";
}

export function endOperation(handle: OperationHandle, outcome: OperationOutcome): void {
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - handle.startedAt.getTime();

  const shouldLog = handle.kind === "write" || !outcome.success;
  if (shouldLog) {
    const summary = redactText(outcome.summary ?? buildDefaultSummary(handle, outcome));
    const detail = outcome.detail ? redactDetail(outcome.detail) : null;
    const level = outcome.level ?? defaultLevel(outcome);

    pushEvent({
      id: handle.operationId,
      occurredAt: handle.startedAt,
      level,
      origin: handle.origin,
      action: handle.useCase,
      actorId: handle.actor.id,
      actorType: handle.actor.type,
      outcome: outcome.success ? "success" : "failure",
      summary,
      detail,
      errorCode: outcome.success ? null : outcome.error.code,
      errorMessage: outcome.success ? null : redactText(outcome.error.message),
      durationMs,
    });
  }

  const { traceSampleRate } = getObservabilityConfig();
  const shouldTrace = !outcome.success || Math.random() < traceSampleRate;
  if (shouldTrace) {
    pushTraceEntry({
      id: crypto.randomUUID(),
      useCase: handle.useCase,
      actorId: handle.actor.id,
      success: outcome.success,
      durationMs,
      startedAt: handle.startedAt,
    });
  }

  const { flushBatchSize } = getObservabilityConfig();
  const sizes = peekBufferSizes();
  if (sizes.event >= flushBatchSize || sizes.trace >= flushBatchSize) {
    void flushNow();
  } else if (sizes.event > 0 || sizes.trace > 0) {
    scheduleFlushAfterResponse();
  }
}
