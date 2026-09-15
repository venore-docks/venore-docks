"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { installPlugin } from "@/platform/plugin-engine/install-plugin";
import {
  previewPluginUninstall,
  type PluginUninstallPreview,
} from "@/platform/plugin-engine/preview-plugin-uninstall";
import { seedPlugin } from "@/platform/plugin-engine/seed-plugin";
import { togglePluginEnabled } from "@/platform/plugin-engine/toggle-plugin-enabled";
import { uninstallPlugin } from "@/platform/plugin-engine/uninstall-plugin";
import type { OperationResult } from "@/shared/types";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

export type PluginsActionState = { error: string | null };

// Roda todos os seeds declarados no manifesto do plugin (hoje sempre um: "example"), parando no
// primeiro erro. Devolve a mensagem de erro ou null.
async function runPluginSeeds(pluginKey: string): Promise<string | null> {
  const manifest = PLUGIN_REGISTRY.find((entry) => entry.key === pluginKey);
  for (const seed of manifest?.seeds ?? []) {
    const result = await seedPlugin({ pluginKey, seedKey: seed.key });
    if (!result.success) {
      return result.error.message;
    }
  }
  return null;
}

// Mesmo padrão de activateThemeAction (/admin/themes/actions.ts): erro do handler é devolvido de
// verdade via useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function togglePluginEnabledAction(
  _prevState: PluginsActionState,
  formData: FormData,
): Promise<PluginsActionState> {
  const pluginKey = String(formData.get("pluginKey") ?? "");
  const enabled = formData.get("enabled") === "true";

  const result = await togglePluginEnabled({ pluginKey, enabled });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/plugins");
  return { error: null };
}

// Instala um plugin já presente no código (src/plugins/registry.ts): roda as migrations do
// plugin, grava o estado INSTALLED_ENABLED e concede as permissions dele ao papel "admin". Se a
// caixa "popular com dados de exemplo" estava marcada, roda os seeds em seguida. Upload de .zip é
// uma sessão futura.
export async function installPluginAction(
  _prevState: PluginsActionState,
  formData: FormData,
): Promise<PluginsActionState> {
  const pluginKey = String(formData.get("pluginKey") ?? "");
  const seedExample = formData.get("seedExample") === "true";

  const result = await installPlugin({ pluginKey });
  if (!result.success) {
    return { error: result.error.message };
  }

  if (seedExample) {
    const seedError = await runPluginSeeds(pluginKey);
    if (seedError) {
      revalidatePath("/admin/plugins");
      return { error: `Plugin instalado, mas os dados de exemplo falharam: ${seedError}` };
    }
  }

  revalidatePath("/admin/plugins");
  return { error: null };
}

// Carrega o preview de consequência da desinstalação "modo B" (schemas dropados, linhas por
// tabela, settings e permissions do namespace) sob demanda quando o diálogo abre — não no load da
// página, porque envolve um COUNT por tabela do plugin. Gateado aqui porque é uma superfície nova
// (a página em si já passa pelo gate de admin).
export async function loadUninstallPreviewAction(
  pluginKey: string,
): Promise<OperationResult<PluginUninstallPreview>> {
  const authz = await authorizeActor("platform.extensions.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }
  return { success: true, data: await previewPluginUninstall(pluginKey) };
}

// Desinstalação "modo B" (docs/issues.md — "Plugins e Temas"). Dois graus:
//   purgeData=false — só tira o plugin do ar (installed_at nulo). Schema, dados e histórico de
//     migrations ficam; reinstalar aplica só as migrations novas. Reversível na prática.
//   purgeData=true  — limpa o banco do plugin (schemas dropados, settings e permissions do
//     namespace apagados). Destrutivo e irreversível: exige que o admin digite a key do plugin
//     para confirmar (mesma ideia do "digite o nome do repositório" do GitHub).
// "Modo A" (desativar, 100% reversível, não mexe em installed_at) continua sendo
// togglePluginEnabledAction.
export async function uninstallPluginAction(
  _prevState: PluginsActionState,
  formData: FormData,
): Promise<PluginsActionState> {
  const pluginKey = String(formData.get("pluginKey") ?? "");
  const purgeData = formData.get("purgeData") === "true";
  const confirmationKey = String(formData.get("confirmationKey") ?? "");

  if (purgeData && confirmationKey.trim() !== pluginKey) {
    return { error: `Digite "${pluginKey}" para confirmar a limpeza do banco.` };
  }

  const result = await uninstallPlugin({ pluginKey, purgeData });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/plugins");
  return { error: null };
}

// Popula os dados de exemplo de um plugin já instalado (botão "Popular dados de exemplo" na
// listagem). Idempotente — cada seed pula o que já existe.
export async function seedPluginAction(
  _prevState: PluginsActionState,
  formData: FormData,
): Promise<PluginsActionState> {
  const pluginKey = String(formData.get("pluginKey") ?? "");

  const seedError = await runPluginSeeds(pluginKey);
  if (seedError) {
    return { error: seedError };
  }

  revalidatePath("/admin/plugins");
  return { error: null };
}
