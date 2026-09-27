import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedPushEndpoint, isValidSubscriptionKey } from "./push-endpoint";

describe("isAllowedPushEndpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QGx",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts the browser push service %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/push",
    "https://fcm.googleapis.com.evil.test/x",
    "https://notify.windows.com.evil.test/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "not a url",
  ])("refuses %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("accepts extra hosts from WEB_PUSH_EXTRA_HOSTS", () => {
    vi.stubEnv("WEB_PUSH_EXTRA_HOSTS", "push.intranet.example");
    expect(isAllowedPushEndpoint("https://push.intranet.example/abc")).toBe(true);
  });
});

describe("isValidSubscriptionKey", () => {
  it("accepts base64url and refuses anything else", () => {
    expect(isValidSubscriptionKey("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM")).toBe(true);
    expect(isValidSubscriptionKey("a b")).toBe(false);
    expect(isValidSubscriptionKey("x".repeat(300))).toBe(false);
  });
});
