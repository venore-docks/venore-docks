import { beginOperation, endOperation } from "@/observability";
import { writeOwnName } from "./store";
import type { SetOwnNameCommand, SetOwnNameResult } from "./types";

export async function setOwnName(command: SetOwnNameCommand): Promise<SetOwnNameResult> {
  const handle = beginOperation({
    useCase: "auth.identity.set-own-name",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const name = command.name.trim();
  if (name.length === 0) {
    const error = { code: "auth.identity.invalid_name", message: "O nome não pode ser vazio." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const updated = await writeOwnName(command.actorId, name);
  if (!updated) {
    const error = { code: "auth.identity.user_not_found", message: "Usuário não encontrado para atualizar o nome." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  endOperation(handle, { success: true, summary: `Usuário ${command.actorId} alterou o próprio nome.` });
  return { success: true, data: { id: updated.id } };
}
