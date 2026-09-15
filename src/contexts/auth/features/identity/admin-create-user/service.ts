import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { hashPassword } from "../password-hashing";
import { findUserIdByEmail, insertUser, isUniqueViolation } from "./store";
import type { AdminCreateUserCommand, AdminCreateUserResult } from "./types";

// Mesmo mínimo de register-with-password/service.ts.
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Criação de conta pelo admin — diferente de register-with-password (autorregistro anônimo): já
// nasce "approved" (default do schema, sem passar por provisionUser) e é sempre auditada, já que
// é uma ação privilegiada sobre a comunidade, não um self-service.
export async function adminCreateUser(command: AdminCreateUserCommand): Promise<AdminCreateUserResult> {
  const email = command.email.trim().toLowerCase();
  const name = command.name.trim();

  const handle = beginOperation({
    useCase: "auth.identity.admin-create-user",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const fail = (code: string, message: string): AdminCreateUserResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  if (!EMAIL_PATTERN.test(email)) {
    return fail("auth.identity.invalid_email", "Informe um email válido.");
  }
  if (name.length === 0) {
    return fail("auth.identity.invalid_name", "Informe o nome do usuário.");
  }
  if (command.password.length < MIN_PASSWORD_LENGTH) {
    return fail("auth.identity.weak_password", `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (await findUserIdByEmail(email)) {
    return fail("auth.identity.email_taken", "Já existe uma conta com esse email.");
  }

  const passwordHash = await hashPassword(command.password);

  let user;
  try {
    user = await insertUser({ email, name, passwordHash });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("auth.identity.email_taken", "Já existe uma conta com esse email.");
    }
    throw error;
  }

  const summary = `Ator ${command.actorId} criou a conta do usuário ${user.id} (${email}).`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "auth.admin-create-user",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { targetUserId: user.id, email },
  });

  return { success: true, data: user };
}
