import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drainEvents, drainTraceEntries } from "./buffer";

vi.mock("./flush", () => ({ flushNow: vi.fn(), scheduleFlushAfterResponse: vi.fn() }));

// origin-registry.ts deriva os nomes de plugin de plugin-keys.generated.ts (vazio no repo do
// core). Uma key fingida cobre o ramo "plugin:".
vi.mock("@/plugins/plugin-keys.generated", () => ({ PLUGIN_KEYS: ["demo"] }));

describe("operation log", () => {
  beforeEach(() => {
    drainEvents();
    drainTraceEntries();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("always logs a successful write operation", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.write-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(handle, { success: true });

    const events = drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "example.write-thing", outcome: "success", level: "info" });
  });

  it("does not log a successful read operation", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.list-things", actor: { id: "u1", type: "user" }, kind: "read" });
    endOperation(handle, { success: true });

    expect(drainEvents()).toHaveLength(0);
  });

  it("logs a failed read operation, carrying the error", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.get-thing", actor: { id: "u1", type: "user" }, kind: "read" });
    endOperation(handle, { success: false, error: { code: "NOT_FOUND", message: "missing" } });

    const events = drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: "failure",
      level: "error",
      errorCode: "NOT_FOUND",
      errorMessage: "missing",
    });
  });

  it("computes duration from start to end", async () => {
    vi.useFakeTimers();
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.write-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    vi.advanceTimersByTime(120);
    endOperation(handle, { success: true });
    vi.useRealTimers();

    expect(drainEvents()[0].durationMs).toBe(120);
  });

  it("always traces a failed operation regardless of sample rate", async () => {
    vi.stubEnv("OBSERVABILITY_TRACE_SAMPLE_RATE", "0");
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.read-thing", actor: { id: "u1", type: "user" }, kind: "read" });
    endOperation(handle, { success: false, error: { code: "BOOM", message: "boom" } });

    expect(drainTraceEntries()).toHaveLength(1);
  });

  it("traces a successful operation only when sampled", async () => {
    vi.stubEnv("OBSERVABILITY_TRACE_SAMPLE_RATE", "0.5");
    vi.spyOn(Math, "random").mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    const { beginOperation, endOperation } = await import("./operation-log");

    const notSampled = beginOperation({ useCase: "example.write-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(notSampled, { success: true });
    expect(drainTraceEntries()).toHaveLength(0);

    const sampled = beginOperation({ useCase: "example.write-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(sampled, { success: true });
    expect(drainTraceEntries()).toHaveLength(1);
  });

  it("generates a default natural-language summary when the caller does not pass one", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "rbac.grant-superadmin", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(handle, { success: true });

    expect(drainEvents()[0].summary).toBe('Ação "rbac.grant-superadmin" concluída com sucesso por user:u1.');
  });

  it("uses the caller-provided summary and detail instead of the default", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "rbac.grant-superadmin", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(handle, { success: true, summary: "Fulano recebeu superadmin.", detail: { promotedUserId: "u2" } });

    expect(drainEvents()[0]).toMatchObject({
      summary: "Fulano recebeu superadmin.",
      detail: { promotedUserId: "u2" },
    });
  });

  it("infers origin from the useCase prefix (context vs plugin) unless one is given explicitly", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const contextHandle = beginOperation({ useCase: "rbac.grant-superadmin", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(contextHandle, { success: true });

    const pluginHandle = beginOperation({ useCase: "demo.publish-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(pluginHandle, { success: true });

    const explicitHandle = beginOperation({
      useCase: "custom.action",
      actor: { id: "u1", type: "user" },
      kind: "write",
      origin: "system:cron",
    });
    endOperation(explicitHandle, { success: true });

    const [contextEvent, pluginEvent, explicitEvent] = drainEvents();
    expect(contextEvent.origin).toBe("context:rbac");
    expect(pluginEvent.origin).toBe("plugin:demo");
    expect(explicitEvent.origin).toBe("system:cron");
  });

  it("lets the caller override the default level (e.g. a degraded-but-successful write)", async () => {
    const { beginOperation, endOperation } = await import("./operation-log");

    const handle = beginOperation({ useCase: "example.write-thing", actor: { id: "u1", type: "user" }, kind: "write" });
    endOperation(handle, { success: true, level: "warn" });

    expect(drainEvents()[0].level).toBe("warn");
  });
});
