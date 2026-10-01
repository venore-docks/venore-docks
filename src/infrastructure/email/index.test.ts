import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailPort } from "./index";

describe("createEmailPort", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is disabled unless a driver is configured", async () => {
    const port = createEmailPort({});
    expect(port.isEnabled()).toBe(false);
    expect((await port.send({ to: "a@b.c", subject: "s", text: "t" })).sent).toBe(false);
  });

  it("stays disabled when resend lacks its key", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(createEmailPort({ EMAIL_DRIVER: "resend" }).isEnabled()).toBe(false);
  });

  it("sends through the Resend HTTP API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const port = createEmailPort({ EMAIL_DRIVER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Site <no-reply@x.com>" });

    expect(await port.send({ to: "a@b.c", subject: "Oi", text: "corpo" })).toEqual({ sent: true, id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "Site <no-reply@x.com>", to: ["a@b.c"], subject: "Oi" });
  });

  it("reports a provider error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 422 })));
    const port = createEmailPort({ EMAIL_DRIVER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "x@x.com" });
    expect(await port.send({ to: "a@b.c", subject: "s", text: "t" })).toEqual({ sent: false, reason: "Resend respondeu HTTP 422." });
  });
});
