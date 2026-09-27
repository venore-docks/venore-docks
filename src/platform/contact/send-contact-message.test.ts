import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const email = { isEnabled: vi.fn(() => true), send: vi.fn(async () => ({ sent: true, id: null })) };
vi.mock("@/infrastructure/email", () => ({ emailPort: email }));

const base = { name: "Ana", email: "ana@x.com", message: "Olá, tudo bem?", website: "", turnstileToken: null, ip: "1.1.1.1", pageUrl: null };

describe("contact form", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    email.send.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends to the sealed recipient, never to one from the request, with reply-to the visitor", async () => {
    const { sealContactToken } = await import("./contact-token");
    const { sendContactMessage } = await import("./send-contact-message");
    const token = sealContactToken("contato@site.com");
    expect(token).not.toContain("contato");

    expect((await sendContactMessage({ ...base, token })).success).toBe(true);
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: "contato@site.com", replyTo: "ana@x.com" }));
  });

  it("rejects a tampered or expired token and silently drops honeypot hits", async () => {
    const { sealContactToken, openContactToken } = await import("./contact-token");
    const { sendContactMessage } = await import("./send-contact-message");
    const token = sealContactToken("contato@site.com", 0);
    expect(openContactToken(token, 1)).toEqual({ recipient: "contato@site.com" });
    expect(openContactToken(token, 8 * 24 * 3600 * 1000)).toBeNull();
    expect((await sendContactMessage({ ...base, token: `${token}x` })).success).toBe(false);

    expect((await sendContactMessage({ ...base, token: sealContactToken("c@s.com"), website: "http://spam" })).success).toBe(true);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("requires a valid Turnstile answer when configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    const { sealContactToken } = await import("./contact-token");
    const { sendContactMessage } = await import("./send-contact-message");
    const result = await sendContactMessage({ ...base, token: sealContactToken("c@s.com"), turnstileToken: "t" });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.objectContaining({ code: "contact.captcha" }) }));
    expect(email.send).not.toHaveBeenCalled();
  });
});
