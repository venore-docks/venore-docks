import { beginOperation, endOperation } from "@/observability";
import { upsertExtensionState } from "./store";
import type { SetExtensionEnabledCommand, SetExtensionEnabledResult } from "./types";

// Persistência pura do estado liga/desliga (auth + auditoria de "quem pediu a troca"). As
// invariantes de negócio (plugin com dependente habilitado, tema ativo, último tema) são
// checadas ANTES de chamar este service, em platform/ (que é quem conhece PLUGIN_REGISTRY e
// THEME_REGISTRY) — este context não sabe o que existe além da própria chave. Nenhum cache pra
// invalidar aqui: as leituras não cacheiam (ver get-extension-state e list-extension-states).
export async function setExtensionEnabled(command: SetExtensionEnabledCommand): Promise<SetExtensionEnabledResult> {
  const handle = beginOperation({
    useCase: `extensions.set-extension-enabled.${command.kind}`,
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const record = await upsertExtensionState(command.kind, command.key, command.enabled, command.actorId);

  endOperation(handle, { success: true });
  return { success: true, data: record };
}
