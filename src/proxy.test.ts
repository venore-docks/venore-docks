import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("proxy — headers x-venore-theme-* (spec §6)", () => {
  it("não repassa ao app nenhum x-venore-theme-* que veio do cliente", () => {
    const request = new NextRequest("https://site.test/rh", {
      headers: { "x-venore-theme-override": "safe-mode", "x-venore-theme-key": "aurora", accept: "text/html" },
    });
    const response = proxy(request);
    const forwarded = (response.headers.get("x-middleware-override-headers") ?? "").split(",");
    expect(forwarded).not.toContain("x-venore-theme-override");
    expect(forwarded).not.toContain("x-venore-theme-key");
    expect(response.headers.get("x-middleware-request-x-venore-theme-override")).toBeNull();
    expect(forwarded).toContain("x-breadcrumb-pathname");
  });
});
