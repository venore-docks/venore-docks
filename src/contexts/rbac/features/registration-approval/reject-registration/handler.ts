import { authorizeActor } from "../../../authorize-actor";
import { rejectRegistration } from "./service";
import type { RejectRegistrationInput, RejectRegistrationResult } from "./types";

export async function rejectRegistrationHandler(input: RejectRegistrationInput): Promise<RejectRegistrationResult> {
  if (input.userId.trim().length === 0) {
    return { success: false, error: { code: "rbac.registrations.invalid_id", message: "userId não pode ser vazio." } };
  }

  const authz = await authorizeActor("rbac.registrations.approve");
  if (!authz.authorized) return { success: false, error: authz.error };

  return rejectRegistration({ ...input, actor: { id: authz.actorId } });
}
