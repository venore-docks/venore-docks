import { describe, expect, it } from "vitest";
import { stripInboundThemeHeaders } from "./strip-inbound-theme-headers";

describe("stripInboundThemeHeaders (proxy, spec §6)", () => {
  it("remove todo x-venore-theme-* vindo de fora e mantém o resto", () => {
    const headers = new Headers({
      "x-venore-theme-override": "safe-mode",
      "X-Venore-Theme-Key": "aurora",
      "x-breadcrumb-pathname": "/x",
      cookie: "a=b",
    });
    stripInboundThemeHeaders(headers);
    expect([...headers.keys()].sort()).toEqual(["cookie", "x-breadcrumb-pathname"]);
  });
});
