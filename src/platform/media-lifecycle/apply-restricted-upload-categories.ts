import { restrictReservedCategoryAssets } from "@/contexts/media";
import type { PluginManifest } from "@/platform/plugin-engine/manifest-schema";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

export type RestrictedUploadCategory = { pluginKey: string; key: string; accessPermission: string };

// Regras declaradas em manifest.restrictedUploadCategories (já validadas pelo manifest-schema:
// categoria e permission do próprio plugin). Contexts não leem PLUGIN_REGISTRY (regra 12) — por
// isso a composição mora aqui.
export function listRestrictedUploadCategories(registry: readonly PluginManifest[] = PLUGIN_REGISTRY): RestrictedUploadCategory[] {
  return registry.flatMap((manifest) =>
    (manifest.restrictedUploadCategories ?? []).map((category) => ({ pluginKey: manifest.key, ...category })),
  );
}

export function findRestrictedUploadCategory(categoryKey: string): RestrictedUploadCategory | null {
  return listRestrictedUploadCategories().find((category) => category.key === categoryKey) ?? null;
}

// Aplica as regras aos arquivos que já estão nas categorias (retroativo). Roda no prebuild
// (scripts/migrate-installed-plugins.ts) e no db:update — idempotente, só toca o que diverge.
// Independe de o plugin estar ativo: desativar o vagas não pode reabrir os currículos.
export async function applyRestrictedUploadCategories(): Promise<{ key: string; restricted: number }[]> {
  const out: { key: string; restricted: number }[] = [];
  for (const category of listRestrictedUploadCategories()) {
    const result = await restrictReservedCategoryAssets({ categoryKey: category.key, accessPermission: category.accessPermission });
    out.push({ key: category.key, restricted: result.success ? result.data.restricted : 0 });
  }
  return out;
}
