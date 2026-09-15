import { authorizeActor } from "@/contexts/rbac";
import { adminCreateUser } from "./service";
import type { AdminCreateUserInput, AdminCreateUserResult } from "./types";

export async function adminCreateUserHandler(input: AdminCreateUserInput): Promise<AdminCreateUserResult> {
  const authz = await authorizeActor("rbac.users.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return adminCreateUser({ actorId: authz.actorId, email: input.email, name: input.name, password: input.password });
}
