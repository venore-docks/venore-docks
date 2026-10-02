import { like } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/database/client";
import { settings } from "@/contexts/settings/database/schema";
import { themeConfigRevisions } from "@/contexts/themes/database/schema";
import type { OperationResult } from "@/shared/types";
import type { ThemeConfigDocument } from "../../contracts/v8/config-document";

// Round trip do ciclo de vida (spec §12, W6): rascunho → publicar → rollback → exportar →
// importar, contra Postgres de verdade. A gravação do settings passa pelo barrel (setSetting →
// authorizeActor); sem sessão HTTP aqui, o ator é fixado no mock de authorizeActor — a
// autorização em si tem testes unitários próprios.
const ACTOR = "integration-actor";
vi.mock("@/contexts/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/contexts/rbac")>()),
  authorizeActor: async () => ({ authorized: true, actorId: ACTOR }),
}));

const { saveThemeDraft } = await import("./save-theme-draft/service");
const { getThemeDraft } = await import("./get-theme-draft/service");
const { publishThemeDraft } = await import("./publish-theme-draft/service");
const { listThemeConfigHistory } = await import("./list-theme-config-history/service");
const { rollbackThemeConfig } = await import("./rollback-theme-config/service");
const { exportThemeConfig } = await import("./export-theme-config/service");
const { importThemeConfig } = await import("./import-theme-config/service");
const { getPublishedThemeConfig } = await import("./get-published-theme-config/service");

function unwrap<T>(result: OperationResult<T>): T {
  if (!result.success) throw new Error(`${result.error.code} — ${result.error.message}`);
  return result.data;
}

const doc = (themeKey: string, presetId?: string): ThemeConfigDocument => ({
  schemaVersion: 1,
  themeKey,
  byTheme: { [themeKey]: { palette: presetId ? { mode: "preset", presetId } : { mode: "default" }, options: {}, fonts: {} } },
  assets: {},
  sections: [{ id: "rh", label: "RH", pathPrefix: "RH/", themeKey: "venore-slime" }],
});

beforeEach(async () => {
  await db.delete(themeConfigRevisions);
  await db.delete(settings).where(like(settings.key, "theme.%"));
});

describe("ciclo de vida da config de tema (Postgres)", () => {
  it("rascunho → publicar → rollback → exportar → importar", async () => {
    const first = unwrap(await saveThemeDraft({ config: doc("venore-slime"), actorId: ACTOR }));
    expect(first.config.sections[0].pathPrefix).toBe("/rh");
    // Um rascunho por site: salvar de novo atualiza a mesma linha.
    const again = unwrap(await saveThemeDraft({ config: doc("venore-slime", "ocean"), actorId: ACTOR }));
    expect(again.id).toBe(first.id);

    const published1 = unwrap(await publishThemeDraft({ actorId: ACTOR }));
    expect(published1.status).toBe("published");
    expect(unwrap(await getThemeDraft())).toBeNull();
    const live1 = unwrap(await getPublishedThemeConfig());
    expect(live1).toMatchObject({ source: "settings", revisionId: published1.id, byTheme: { "venore-slime": { palette: { mode: "preset", presetId: "ocean" } } } });

    unwrap(await saveThemeDraft({ config: doc("venore-slime"), actorId: ACTOR }));
    const published2 = unwrap(await publishThemeDraft({ actorId: ACTOR }));
    const history = unwrap(await listThemeConfigHistory()).items;
    expect(history.map((item) => [item.id, item.status])).toEqual([
      [published2.id, "published"],
      [published1.id, "archived"],
    ]);

    const restored = unwrap(await rollbackThemeConfig({ revisionId: published1.id, actorId: ACTOR }));
    expect(restored.id).not.toBe(published1.id);
    expect(restored.basedOnRevisionId).toBe(published1.id);
    expect(unwrap(await getPublishedThemeConfig()).revisionId).toBe(restored.id);
    expect(unwrap(await listThemeConfigHistory()).items).toHaveLength(3);

    const envelope = unwrap(await exportThemeConfig({ actorId: ACTOR, themeVersion: "1.0.0" }));
    expect(envelope.config.byTheme["venore-slime"].palette).toEqual({ mode: "preset", presetId: "ocean" });

    const imported = unwrap(await importThemeConfig({ envelope, warnings: [], actorId: ACTOR }));
    expect(imported.draft.status).toBe("draft");
    // Importar não publica: o publicado continua sendo o do rollback.
    expect(unwrap(await getPublishedThemeConfig()).revisionId).toBe(restored.id);
  });

  it("publicação poda o histórico em 20 arquivados", async () => {
    for (let index = 0; index < 23; index += 1) {
      unwrap(await saveThemeDraft({ config: doc("venore-slime"), actorId: ACTOR }));
      unwrap(await publishThemeDraft({ actorId: ACTOR }));
    }
    const rows = await db.select({ status: themeConfigRevisions.status }).from(themeConfigRevisions);
    expect(rows.filter((row) => row.status === "archived")).toHaveLength(20);
    expect(rows.filter((row) => row.status === "published")).toHaveLength(1);
  });
});
