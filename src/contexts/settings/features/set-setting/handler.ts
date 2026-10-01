import { authorizeActor } from "@/contexts/rbac";
import { permissionsToWriteSetting } from "../../contracts/types";
import { setSetting } from "./service";
import type { SetSettingInput, SetSettingResult } from "./types";

export async function setSettingHandler(input: SetSettingInput): Promise<SetSettingResult> {
  if (input.key.trim().length === 0) {
    return { success: false, error: { code: "settings.set.invalid_key", message: "key não pode ser vazio." } };
  }

  // G5 (docs/issues.md): setting de plugin também pode ser gravada com
  // `<plugin>.settings.manage` — ver permissionsToWriteSetting.
  const authz = await authorizeActor(permissionsToWriteSetting(input.key.trim()));
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return setSetting({ ...input, actorId: authz.actorId });
}
