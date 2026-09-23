import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { isPluginActive } from "./is-plugin-active";

// Só uma categoria DECLARADA em manifest.anonymousUploadCategories de algum plugin ATIVO autoriza
// upload sem sessão nela (ver comentário em manifest-schema.ts) — nenhum outro código decide isso
// em runtime. Contexts não podem consultar PLUGIN_REGISTRY (regra 12, mesmo racional de
// delete-media-safely.ts), por isso esta checagem mora em platform/, não em contexts/media.
export async function isAnonymousUploadCategoryAllowed(categoryKey: string): Promise<boolean> {
  for (const manifest of PLUGIN_REGISTRY) {
    if (!manifest.anonymousUploadCategories?.includes(categoryKey)) continue;
    if (await isPluginActive(manifest.key)) return true;
  }
  return false;
}
