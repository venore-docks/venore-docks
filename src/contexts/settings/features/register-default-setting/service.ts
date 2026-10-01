import { beginOperation, endOperation } from "@/observability";
import { invalidateCache } from "../../../../infrastructure/cache/memory-cache";
import { insertSettingIfMissing } from "./store";
import type { RegisterDefaultSettingInput, RegisterDefaultSettingResult } from "./types";

// Chaves cujo default já foi confirmado no banco (gravado agora ou já existente) neste processo.
// Os leitores de settings do layout (brand, header-behavior, nav-visibility) chamam isto a cada
// request; sem a memória, cada página fazia um INSERT ... ON CONFLICT DO NOTHING por chave. Não
// existe exclusão de setting, então "já confirmado" não volta a ficar falso. globalThis pelo
// mesmo motivo de memory-cache.ts (uma cópia do módulo por camada de bundle do Next).
type RegisteredGlobal = typeof globalThis & { __venoreSettingsDefaultsConfirmed?: Set<string> };

function confirmedKeys(): Set<string> {
  const globalWithSet = globalThis as RegisteredGlobal;
  if (!globalWithSet.__venoreSettingsDefaultsConfirmed) {
    globalWithSet.__venoreSettingsDefaultsConfirmed = new Set();
  }
  return globalWithSet.__venoreSettingsDefaultsConfirmed;
}

export async function registerDefaultSetting(command: RegisterDefaultSettingInput): Promise<RegisterDefaultSettingResult> {
  const confirmed = confirmedKeys();
  if (confirmed.has(command.key)) {
    return { success: true, data: { key: command.key, registered: false } };
  }

  const handle = beginOperation({
    useCase: "settings.register-default-setting",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  const registered = await insertSettingIfMissing(command.key, command.value);
  confirmed.add(command.key);

  // Só invalida se de fato gravou — chave já existente (default ou valor de admin) não muda.
  if (registered) {
    invalidateCache(`settings:${command.key}`);
  }

  endOperation(handle, { success: true });
  return { success: true, data: { key: command.key, registered } };
}

// Esquece as chaves confirmadas que começam com `prefix` ("" = todas) — quem apaga linha de
// settings por fora (desinstalar plugin com limpeza de banco) chama isto via
// forgetSettingsByPrefix, senão o próximo registerDefaultSetting da chave seria pulado.
export function forgetConfirmedDefaultSettings(prefix: string): void {
  const confirmed = confirmedKeys();
  for (const key of confirmed) {
    if (key.startsWith(prefix)) confirmed.delete(key);
  }
}
