import { describe, expect, it, vi } from "vitest";
import type { PluginRouteTable } from "./types";

// Tabela de rotas fingida (sem plugins no repo) — a lógica sob teste é o despacho de
// resolvePublicPluginRoute: casar o caminho, respeitar plugin desativado e repassar o
// generateMetadata opcional da entrada pro catch-all do CMS.
const matchPage = () => null;
const matchMetadata = vi.fn(async ({ params }: { params: Promise<Record<string, string>> }) => ({
  title: `Jogo ${(await params).id}`,
}));
const disabledPage = () => null;

vi.mock("@/plugins/route-registry", () => ({
  PLUGIN_ROUTE_TABLES: {
    alpha: {
      public: [
        { pattern: "alpha/jogos/:id", Component: matchPage, generateMetadata: matchMetadata },
        { pattern: "alpha/sobre", Component: matchPage },
      ],
    },
    beta: { public: [{ pattern: "beta", Component: disabledPage }] },
  } satisfies Record<string, PluginRouteTable>,
}));

vi.mock("@/platform/plugin-engine/is-plugin-active", () => ({
  isPluginActive: async (key: string) => key === "alpha",
}));

const { resolvePublicPluginRoute } = await import("./resolve-public-route");

describe("resolvePublicPluginRoute", () => {
  it("repassa o generateMetadata da entrada casada, com os mesmos params do Component", async () => {
    const resolved = await resolvePublicPluginRoute(["alpha", "jogos", "123"]);
    expect(resolved.kind).toBe("matched");
    if (resolved.kind !== "matched") return;

    expect(resolved.Component).toBe(matchPage);
    expect(resolved.params).toEqual({ id: "123" });
    expect(resolved.generateMetadata).toBeDefined();
    await expect(
      resolved.generateMetadata!({ params: Promise.resolve(resolved.params), searchParams: Promise.resolve({}) }),
    ).resolves.toEqual({ title: "Jogo 123" });
  });

  it("entrada sem generateMetadata casa normalmente, sem metadata próprio", async () => {
    const resolved = await resolvePublicPluginRoute(["alpha", "sobre"]);
    expect(resolved.kind).toBe("matched");
    if (resolved.kind !== "matched") return;
    expect(resolved.generateMetadata).toBeUndefined();
  });

  it("plugin desativado reserva o caminho (notFound), fora de plugin segue pro CMS", async () => {
    await expect(resolvePublicPluginRoute(["beta"])).resolves.toEqual({ kind: "reserved-not-found" });
    await expect(resolvePublicPluginRoute(["qualquer", "pagina"])).resolves.toEqual({ kind: "not-a-plugin-route" });
  });
});
