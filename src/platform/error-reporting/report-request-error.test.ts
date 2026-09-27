import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endOperation = vi.fn();
vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: (...args: unknown[]) => endOperation(...args) }));

const request = { path: "/x", method: "GET" };
const context = { routePath: "/[...slug]", routeType: "render" };

describe("reportRequestError", () => {
  const fetchMock = vi.fn(async () => new Response(null));
  beforeEach(() => {
    endOperation.mockReset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("logs a real error and forwards it to the webhook when configured", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example.test/x");
    const { reportRequestError } = await import("./report-request-error");
    await reportRequestError(new Error("boom"), request, context);
    expect(endOperation).toHaveBeenCalledWith({}, expect.objectContaining({ success: false }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores Next control flow (redirect / notFound)", async () => {
    const { reportRequestError } = await import("./report-request-error");
    await reportRequestError(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/login" }), request, context);
    expect(endOperation).not.toHaveBeenCalled();
  });

  it("never throws when the webhook is down", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example.test/x");
    fetchMock.mockRejectedValueOnce(new Error("down"));
    const { reportRequestError } = await import("./report-request-error");
    await expect(reportRequestError(new Error("boom"), request, context)).resolves.toBeUndefined();
  });
});
