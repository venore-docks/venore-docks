import { beginOperation, endOperation } from "@/observability";
import { hashPassword } from "../../identity/password-hashing";
import { findUserIdByEmail, insertUserWithPassword, isUniqueViolation } from "./store";
import type { RegisterWithPasswordInput, RegisterWithPasswordResult } from "./types";

// Mesmo mínimo do set-own-password (auth/features/identity/set-own-password/service.ts).
const MIN_PASSWORD_LENGTH = 8;
// Validação de forma, não de existência — o gate real é a unique constraint + o pré-check abaixo.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cria auth.users com senha para um visitante anônimo (provider Credentials). NÃO decide papel
// nem status final: isso é composição de auth + rbac e mora fora dos dois contexts
// (src/platform/registration/handle-user-registered.ts — regra 12), chamada pelo Server Action
// logo depois, igual ao evento `createUser` do Auth.js pro fluxo OAuth. O usuário nasce com o
// default do schema ("pending") e handle-user-registered decide se aprova (aprovação desligada).
export async function registerWithPassword(input: RegisterWithPasswordInput): Promise<RegisterWithPasswordResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  const handle = beginOperation({
    useCase: "auth.registration.register-with-password",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  const fail = (code: string, message: string): RegisterWithPasswordResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  if (!EMAIL_PATTERN.test(email)) {
    return fail("auth.registration.invalid_email", "Informe um email válido.");
  }
  if (name.length === 0) {
    return fail("auth.registration.invalid_name", "Informe seu nome.");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return fail("auth.registration.weak_password", `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (await findUserIdByEmail(email)) {
    return fail("auth.registration.email_taken", "Já existe uma conta com esse email.");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await insertUserWithPassword({ email, name, passwordHash });
    endOperation(handle, { success: true, summary: `Registro por senha: ${email}` });
    return { success: true, data: user };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("auth.registration.email_taken", "Já existe uma conta com esse email.");
    }
    throw error;
  }
}
