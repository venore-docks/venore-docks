import { describe, expect, it, vi } from "vitest";
import { createSpeechWorkerTrigger } from "./github-worker-trigger";

const response = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });

describe("createSpeechWorkerTrigger", () => {
  it("sem token: não chama o GitHub", async () => {
    const fetchImpl = vi.fn();
    const trigger = createSpeechWorkerTrigger({}, fetchImpl);
    expect(trigger.isConfigured()).toBe(false);
    expect((await trigger.dispatch()).ok).toBe(false);
    expect(await trigger.latestRun()).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(trigger.actionsUrl).toBe("https://github.com/venore-docks/venore-docks/actions/workflows/speech-worker.yml");
  });

  it("dispara o workflow no branch configurado", async () => {
    const fetchImpl = vi.fn(async () => response(204));
    const trigger = createSpeechWorkerTrigger({ SPEECH_WORKER_GITHUB_TOKEN: "t", SPEECH_WORKER_GITHUB_REPO: "dono/repo", SPEECH_WORKER_GITHUB_REF: "prod" }, fetchImpl);
    expect(await trigger.dispatch()).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/dono/repo/actions/workflows/speech-worker.yml/dispatches");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "prod" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
  });

  it("recusa do GitHub vira erro legível", async () => {
    const trigger = createSpeechWorkerTrigger({ SPEECH_WORKER_GITHUB_TOKEN: "t" }, vi.fn(async () => response(403)));
    expect(await trigger.dispatch()).toEqual({ ok: false, error: "GitHub respondeu HTTP 403 ao pedir a execução do worker." });
  });

  it("lê a execução mais recente", async () => {
    const run = {
      status: "in_progress",
      conclusion: null,
      event: "workflow_dispatch",
      run_started_at: "2026-10-06T20:00:00Z",
      created_at: "2026-10-06T19:59:00Z",
      updated_at: "2026-10-06T20:01:00Z",
      html_url: "https://github.com/x/y/actions/runs/1",
    };
    const trigger = createSpeechWorkerTrigger({ SPEECH_WORKER_GITHUB_TOKEN: "t" }, vi.fn(async () => response(200, { workflow_runs: [run] })));
    expect(await trigger.latestRun()).toEqual({
      status: "in_progress",
      conclusion: null,
      event: "workflow_dispatch",
      startedAt: "2026-10-06T20:00:00Z",
      updatedAt: "2026-10-06T20:01:00Z",
      url: "https://github.com/x/y/actions/runs/1",
    });
  });
});
