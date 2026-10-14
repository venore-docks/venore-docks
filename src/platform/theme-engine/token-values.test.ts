import { describe, expect, it } from "vitest";
import { THEME_TOKEN_VALUES } from "@/themes/theme-tokens.generated";
import { createTokenResolver, effectiveTokens, getThemeTokenValues, regionSurfaceToken } from "./token-values";

describe("createTokenResolver", () => {
  const tokens = {
    primary: "oklch(0.6 0.1 150)",
    ring: "var(--primary)",
    "chart-1": "var(--missing, var(--ring))",
    soft: "color-mix(in oklch, var(--primary) 20%, transparent)",
    blend: "color-mix(in oklch, var(--primary), oklch(1 0 0))",
    "under-100": "color-mix(in oklch, var(--primary) 30%, oklch(1 0 0) 30%)",
    "cycle-a": "var(--cycle-b)",
    "cycle-b": "var(--cycle-a)",
    gradient: "linear-gradient(var(--primary), var(--ring))",
  };
  const resolver = createTokenResolver(tokens);

  it("segue var() e o fallback de var()", () => {
    expect(resolver.color("ring")).toMatchObject({ l: 0.6, c: 0.1, h: 150 });
    expect(resolver.color("--chart-1")).toMatchObject({ l: 0.6 });
  });

  it("resolve color-mix com transparent (alpha) e sem porcentagens (50/50)", () => {
    expect(resolver.color("soft")).toMatchObject({ l: 0.6, alpha: expect.closeTo(0.2, 6) });
    expect(resolver.color("blend")!.l).toBeCloseTo(0.8, 6);
  });

  it("soma de porcentagens < 100 multiplica o alpha", () => {
    expect(resolver.color("under-100")!.alpha).toBeCloseTo(0.6, 6);
  });

  it("ciclo e não-cor resolvem pra null (sem estourar a pilha)", () => {
    expect(resolver.color("cycle-a")).toBeNull();
    expect(resolver.color("gradient")).toBeNull();
    expect(resolver.color("nope")).toBeNull();
  });
});

describe("tokens do registro (theme-tokens.generated.ts)", () => {
  it("todo tema tem light/dark e os papéis de região resolvem pra cor", () => {
    const keys = Object.keys(THEME_TOKEN_VALUES);
    expect(keys).toContain("venore-slime");
    for (const key of keys) {
      const values = getThemeTokenValues(key)!;
      for (const mode of ["light", "dark"] as const) {
        const resolver = createTokenResolver(values[mode]);
        for (const role of ["background", "foreground", "muted-foreground", "ring", "accent", "card"]) {
          expect(resolver.color(role), `${key} ${mode} ${role}`).not.toBeNull();
        }
      }
    }
  });

  it("dark do slime é o efetivo (base + .dark): token só do base continua lá", () => {
    const slime = getThemeTokenValues("venore-slime")!;
    expect(slime.dark.background).toBe("oklch(0.172 0.011 168)");
    expect(slime.dark["overlay-foreground"]).toBe("oklch(1 0 0)");
  });

  it("effectiveTokens põe a paleta por cima da base", () => {
    const merged = effectiveTokens(getThemeTokenValues("venore-slime"), { light: { primary: "#ff0000" } });
    expect(merged.light.primary).toBe("#ff0000");
    expect(merged.dark.primary).toBe("oklch(0.72 0.145 156)");
  });
});

describe("regionSurfaceToken", () => {
  it("tier-3 declarado > superfície do kit > tier-2", () => {
    expect(regionSurfaceToken("rail", "background", { "region-rail-background": "#000", "sidebar-bg-start": "#111" })).toBe(
      "region-rail-background",
    );
    expect(regionSurfaceToken("rail", "background", { "sidebar-bg-start": "#111" })).toBe("sidebar-bg-start");
    expect(regionSurfaceToken("header", "background", { "header-bg": "#fff" })).toBe("header-bg");
    expect(regionSurfaceToken("content", "background", { "header-bg": "#fff" })).toBe("background");
    expect(regionSurfaceToken("rail", "foreground", {})).toBe("foreground");
  });
});
