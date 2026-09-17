import { setExtensionEnabled } from "@/contexts/extensions";
import type { OperationResult } from "@/shared/types";
import { findEnabledDependents } from "./find-dependent-plugins";
import { registerPlugins } from "./register-plugins";

export type TogglePluginEnabledInput = { pluginKey: string; enabled: boolean };

// Composição do ponto de wiring (docs/venore-docks.md — regra 12): checa a invariante de
// dependência (que exige conhecer PLUGIN_REGISTRY, algo que contexts/extensions não pode
// importar) e só então delega a persistência a contexts/extensions, que resolve autorização
// (platform.extensions.manage) e auditoria por conta própria.
export async function togglePluginEnabled(command: TogglePluginEnabledInput): Promise<OperationResult<void>> {
  if (!command.enabled) {
    const report = await registerPlugins();
    const dependents = findEnabledDependents(command.pluginKey, report);
    if (dependents.length > 0) {
      const names = dependents.map((dependent) => dependent.name).join(", ");
      return {
        success: false,
        error: {
          code: "plugin-engine.disable.blocked_by_dependents",
          message: `Não é possível desabilitar "${command.pluginKey}": ${names} depende${dependents.length > 1 ? "m" : ""} dele.`,
        },
      };
    }
  }

  const result = await setExtensionEnabled({ kind: "plugin", key: command.pluginKey, enabled: command.enabled });
  if (!result.success) {
    return result;
  }

  return { success: true, data: undefined };
}
