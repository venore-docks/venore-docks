import { RBAC_PERMISSIONS } from "@/contexts/rbac";
import { registerDefaultSetting } from "@/contexts/settings";
import { listExtensionStates } from "@/contexts/extensions";
import { beginOperation, endOperation } from "@/observability";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { isCoreVersionCompatible } from "./check-compatibility";
import type { PluginManifest } from "./manifest-schema";
import { resolveDependencies } from "./resolve-dependencies";
import type { PluginRegistrationEntry, PluginRegistrationReport } from "./types";
import { validateManifest } from "./validate-manifest";

// Motor de plugins (docs/venore-docks.md — "Sistema de plugins"): lê os manifestos declarados em
// src/plugins/registry.ts e checa o estado de extensão (contexts/extensions) ANTES de
// compatibilidade e dependência:
// - plugin sem linha de estado (ou `installed=false`) == "available": não contribui nada
//   (navegação, permission, bloco, setting), a tela de admin mostra um botão "Instalar" que
//   roda as migrations (platform/plugin-engine/install-plugin.ts).
// - plugin instalado mas `enabled=false` == "disabled": também não contribui nada, mas o admin
//   pode reabilitar sem reinstalar.
// Depois valida, checa compatibilidade de versão, resolve dependências e monta o relatório de
// registro. Roda no bootstrap, sem ator humano — por isso actor "system" no log, mesmo espírito
// de contexts/rbac/features/role-assignment/assign-default-role.
//
// Sem cache (havia um TTL de 30s aqui antes, num Map em globalThis): o app roda como funções
// serverless (Vercel), cada instância com sua própria memória de processo, então instalar/
// desinstalar/(des)habilitar um plugin numa instância não invalidava o cache das outras — o
// sintoma era um plugin aparecer "instalado" na tela, "desinstalado" ao navegar, e rota do
// plugin dando 404, até o TTL expirar em todas as instâncias que ficaram com a versão velha.
// listExtensionStates() por baixo também não cacheia mais, pelo mesmo motivo.
export async function registerPlugins(manifests?: unknown[]): Promise<PluginRegistrationReport> {
  const inputManifests = manifests ?? PLUGIN_REGISTRY;

  const handle = beginOperation({
    useCase: "platform.plugin-engine.register-plugins",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  const extensionStates = await listExtensionStates({ kind: "plugin" });
  const stateByKey = extensionStates.success ? extensionStates.data : {};
  // Não instalado (sem linha, ou linha com installed=false) == "available".
  const isInstalled = (key: string) => stateByKey[key]?.installed ?? false;
  // Instalado + enabled=false == "disabled".
  const disabledKeys = new Set(
    Object.entries(stateByKey).filter(([, entry]) => entry.installed && !entry.enabled).map(([key]) => key),
  );

  const entries: PluginRegistrationEntry[] = [];
  const compatible: PluginManifest[] = [];

  for (const raw of inputManifests) {
    const validation = validateManifest(raw);
    if (!validation.valid) {
      entries.push({ key: validation.key, status: "invalid", errors: validation.errors });
      continue;
    }

    const { manifest } = validation;

    if (!isInstalled(manifest.key)) {
      entries.push({ key: manifest.key, status: "available", manifest, errors: [] });
      continue;
    }

    if (disabledKeys.has(manifest.key)) {
      entries.push({ key: manifest.key, status: "disabled", manifest, errors: [] });
      continue;
    }

    if (manifest.compatibility && !isCoreVersionCompatible(manifest.compatibility.coreVersion)) {
      entries.push({
        key: manifest.key,
        status: "incompatible",
        manifest,
        errors: [`coreVersion "${manifest.compatibility.coreVersion}" incompatível com o core atual.`],
      });
      continue;
    }

    compatible.push(manifest);
  }

  const resolution = resolveDependencies(compatible);
  const activePlugins: PluginManifest[] = [];

  for (const manifest of compatible) {
    const status = resolution[manifest.key];
    entries.push({ key: manifest.key, status: status.status, manifest, errors: status.errors });
    if (status.status === "active") {
      activePlugins.push(manifest);
    }
  }

  for (const plugin of activePlugins) {
    for (const setting of plugin.settings ?? []) {
      await registerDefaultSetting({ key: setting.key, value: setting.defaultValue });
    }
  }

  const report: PluginRegistrationReport = {
    entries,
    permissions: [...RBAC_PERMISSIONS, ...activePlugins.flatMap((plugin) => plugin.permissions ?? [])],
    navigation: activePlugins.flatMap((plugin) => plugin.navigation ?? []),
    routes: activePlugins.flatMap((plugin) => plugin.routes ?? []),
    contentTypes: activePlugins.flatMap((plugin) => plugin.contentTypes ?? []),
    blocks: activePlugins.flatMap((plugin) => plugin.blocks ?? []),
  };

  endOperation(handle, { success: true });

  return report;
}
