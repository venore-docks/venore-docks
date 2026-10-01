import { beginOperation, endOperation } from "@/observability";
import { invalidateCache } from "../../../../infrastructure/cache/memory-cache";
import { publishSettingsChange } from "../../settings-cache-version";
import { upsertSetting } from "./store";
import type { SetSettingCommand, SetSettingResult } from "./types";

export async function setSetting(command: SetSettingCommand): Promise<SetSettingResult> {
  const handle = beginOperation({
    useCase: "settings.set-setting",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const record = await upsertSetting(command.key, command.value);

  // Invalidação é responsabilidade de quem escreve (docs/venore-docks.md — Cache): local na hora,
  // nas outras instâncias em até 5 s (settings-cache-version.ts).
  invalidateCache(`settings:${command.key}`);
  await publishSettingsChange();

  endOperation(handle, { success: true });
  return { success: true, data: record };
}
