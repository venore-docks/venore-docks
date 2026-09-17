import { listExtensionStates, setExtensionInstalled } from "@/contexts/extensions";
import { grantPermissionsToRole } from "@/contexts/rbac";
import type { OperationResult } from "@/shared/types";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { runPluginMigrations } from "./run-plugin-migrations";

export type InstallPluginInput = { pluginKey: string };

// Composição do ponto de wiring (docs/venore-docks.md — regra 12): conhecer o PLUGIN_REGISTRY e
// rodar as migrations é papel de platform/; a persistência do estado "instalado" (auth
// platform.extensions.manage + auditoria) fica com contexts/extensions; conceder as permissions
// do plugin ao papel "admin" fica com contexts/rbac.
//
// Ordem importa: roda a migration ANTES de marcar instalado. Se a migration falha, o plugin
// continua "available" (sem estado), então uma nova tentativa de instalar reexecuta do zero em
// vez de deixar um plugin "instalado" apontando pra um schema que não subiu.
export async function installPlugin(command: InstallPluginInput): Promise<OperationResult<void>> {
  const manifest = PLUGIN_REGISTRY.find((entry) => entry.key === command.pluginKey);
  if (!manifest) {
    return {
      success: false,
      error: {
        code: "plugin-engine.install.unknown_plugin",
        message: `Plugin "${command.pluginKey}" não está no registro (src/plugins/registry.ts).`,
      },
    };
  }

  const states = await listExtensionStates({ kind: "plugin" });
  const alreadyInstalled = states.success && Boolean(states.data[command.pluginKey]?.installed);

  // Já instalado: pula a migration e a marca de estado (idempotente — não reexecuta migration),
  // mas ainda segue pro passo de concessão de permissions abaixo, que também é idempotente.
  // Assim, clicar "Instalar" de novo repara uma instalação feita antes desse passo existir.
  if (!alreadyInstalled) {
    if (manifest.migrationsPath) {
      const migrationResult = await runPluginMigrations(command.pluginKey);
      if (!migrationResult.success) {
        return migrationResult;
      }
    }

    const result = await setExtensionInstalled({ kind: "plugin", key: command.pluginKey });
    if (!result.success) {
      return result;
    }
  }

  // I4 (docs/issues.md): registerPlugins() só devolve as permissions do plugin pro catálogo de
  // /admin/rbac — nunca as grava em rbac.role_permissions, então o papel "admin" não enxerga
  // nenhuma tela do plugin até alguém marcar na mão. Conceder aqui, no install, de forma aditiva
  // e idempotente. superadmin não precisa — authorize-actor.ts libera incondicional.
  if (manifest.permissions && manifest.permissions.length > 0) {
    const grant = await grantPermissionsToRole({
      roleKey: "admin",
      permissionKeys: manifest.permissions.map((permission) => permission.key),
    });
    if (!grant.success) {
      return { success: false, error: grant.error };
    }
  }

  return { success: true, data: undefined };
}
