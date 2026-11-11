import { describe, expect, it, vi } from "vitest";
import type { PluginRouteTable } from "./types";

// Tabela fingida: o que se testa é o despacho de resolveStandalonePluginRoute — casar o caminho
// (depois de /ext/), respeitar plugin desativado e repassar o generateMetadata opcional da entrada
// (usado por PWAs de plugin para declarar o próprio manifest).
const appPage = () => null;
const plainPage = () => null;
const appMetadata = vi.fn(async ({ params }: { params: Promise<Record<string, string>> }) => ({
  title: `Chamado ${(await params).id}`,
  manifest: "/api/alpha/app/manifest",
}));

vi.mock("@/plugins/route-registry", () => ({
  PLUGIN_ROUTE_TABLES: {
    alpha: {
      standalone: [
        { pattern: "alpha/app/chamado/:id", Component: appPage, generateMetadata: appMetadata },
        { pattern: "alpha/out/:token", Component: plainPage },
      ],
    },
    beta: { standalone: [{ pattern: "beta/app", Component: plainPage }] },
  } satisfies Record<string, PluginRouteTable>,
}));

vi.mock("@/platform/plugin-engine/is-plugin-active", () => ({
  isPluginActive: async (key: string) => key === "alpha",
}));

const { resolveStandalonePluginRoute } = await import("./resolve-standalone-route");

describe("resolveStandalonePluginRoute", () => {
  it("repassa o generateMetadata da entrada casada, com os mesmos params do Component", async () => {
    const resolved = await resolveStandalonePluginRoute(["alpha", "app", "chamado", "42"]);
    expect(resolved.kind).toBe("matched");
    if (resolved.kind !== "matched") return;

    expect(resolved.Component).toBe(appPage);
    expect(resolved.params).toEqual({ id: "42" });
    await expect(
      resolved.generateMetadata!({ params: Promise.resolve(resolved.params), searchParams: Promise.resolve({}) }),
    ).resolves.toEqual({ title: "Chamado 42", manifest: "/api/alpha/app/manifest" });
  });

  it("entrada sem generateMetadata casa normalmente, sem metadata próprio", async () => {
    const resolved = await resolveStandalonePluginRoute(["alpha", "out", "tok"]);
    expect(resolved.kind).toBe("matched");
    if (resolved.kind !== "matched") return;
    expect(resolved.generateMetadata).toBeUndefined();
  });

  it("plugin desativado reserva o caminho; caminho desconhecido não é de plugin", async () => {
    expect(await resolveStandalonePluginRoute(["beta", "app"])).toEqual({ kind: "reserved-not-found" });
    expect(await resolveStandalonePluginRoute(["nada", "aqui"])).toEqual({ kind: "not-a-plugin-route" });
  });
});
