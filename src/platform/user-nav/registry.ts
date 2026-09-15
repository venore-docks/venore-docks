import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { beginOperation, endOperation } from "@/observability";
import type { NavItem } from "@/contexts/themes";
import { registerPlugins } from "../plugin-engine/register-plugins";

// Itens que os plugins ativos contribuem pro MENU DO USUÁRIO (user-nav), não pro admin-nav. Vêm
// de src/plugins/*/contributions.ts (campo `userNavItems`), agregados em PLUGIN_CONTRIBUTIONS pelo
// codegen — platform/theme-rendering não pode importar um plugin diretamente (boundary). Só o
// plugin ativo entra.
//
// Mesmo risco de collectNotificationAlert (notification-registry.ts): plugin "active" no
// manifesto mas ainda sem migration aplicada não pode travar o shell inteiro. Falha de um
// provider vira log e é ignorada.
export async function collectUserNavItems(): Promise<NavItem[]> {
  const pluginReport = await registerPlugins();
  const activePluginKeys = new Set(
    pluginReport.entries.filter((entry) => entry.status === "active").map((entry) => entry.key),
  );

  const items: NavItem[] = [];
  for (const [key, contributions] of Object.entries(PLUGIN_CONTRIBUTIONS)) {
    if (!activePluginKeys.has(key) || !contributions.userNavItems) continue;
    const handle = beginOperation({
      useCase: "platform.user-nav.collect-user-nav-items",
      actor: { id: "system", type: "system" },
      kind: "read",
    });
    try {
      items.push(...(await contributions.userNavItems()));
      endOperation(handle, { success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      endOperation(handle, {
        success: false,
        error: { code: "platform.user-nav.provider_failed", message: `Plugin "${key}": ${message}` },
      });
    }
  }
  return items;
}
