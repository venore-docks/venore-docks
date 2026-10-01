import { createHash, timingSafeEqual } from "node:crypto";
import { activateUser, getSessionIdentity, registerWithPassword } from "@/contexts/auth";
import { grantSuperadmin, superadminExists } from "@/contexts/rbac";
import { checkRateLimit } from "@/infrastructure/rate-limit";
import type { OperationResult } from "@/shared/types";

// Primeiro superadmin via web, gated por SETUP_TOKEN (variável de ambiente que só quem controla o
// deploy conhece). Substitui o "primeiro cadastro vira superadmin", que deixava uma instância
// recém-publicada ser tomada por quem chegasse primeiro. Alternativa sem web: instalador
// (npm run db:install:fresh) ou npm run db:bootstrap-superadmin.
const MIN_TOKEN_LENGTH = 16;
const SETUP_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

export type BootstrapSuperadminInput =
  | { mode: "session"; token: string; clientIp: string }
  | { mode: "create"; token: string; clientIp: string; name: string; email: string; password: string };

export type BootstrapSuperadminResult = OperationResult<{ userId: string; created: boolean }>;

function fail(code: string, message: string): BootstrapSuperadminResult {
  return { success: false, error: { code: `setup.${code}`, message } };
}

export function isSetupTokenConfigured(): boolean {
  return (process.env.SETUP_TOKEN?.trim().length ?? 0) >= MIN_TOKEN_LENGTH;
}

// Comparação em tempo constante sobre o digest (tamanhos iguais sempre).
function tokenMatches(candidate: string): boolean {
  const expected = process.env.SETUP_TOKEN?.trim() ?? "";
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(candidate.trim()).digest();
  return timingSafeEqual(a, b);
}

export async function bootstrapSuperadmin(input: BootstrapSuperadminInput): Promise<BootstrapSuperadminResult> {
  const limit = await checkRateLimit(`auth.setup:${input.clientIp}`, SETUP_RATE_LIMIT);
  if (!limit.allowed) {
    return fail("rate_limited", "Muitas tentativas. Aguarde antes de tentar de novo.");
  }

  if (!isSetupTokenConfigured()) {
    return fail("disabled", "A configuração pela web está desativada: defina SETUP_TOKEN (16+ caracteres) no ambiente.");
  }
  if (!tokenMatches(input.token)) {
    return fail("invalid_token", "Token de configuração inválido.");
  }

  const exists = await superadminExists();
  if (!exists.success) return exists;
  if (exists.data) {
    return fail("already_done", "A configuração inicial já foi concluída.");
  }

  let userId: string;
  let created = false;
  if (input.mode === "session") {
    const identity = await getSessionIdentity();
    if (!identity.success) return identity;
    if (!identity.data) return fail("no_session", "Entre com sua conta antes de concluir a configuração.");
    userId = identity.data.id;
  } else {
    const registered = await registerWithPassword({ name: input.name, email: input.email, password: input.password });
    if (!registered.success) return registered;
    userId = registered.data.id;
    created = true;
  }

  // grantSuperadmin (sem bypass) re-checa que ainda não existe superadmin — fecha a corrida entre
  // duas submissões simultâneas com o token.
  const granted = await grantSuperadmin({ userId });
  if (!granted.success) return granted;

  const activated = await activateUser({ userId, reason: "bootstrap" });
  if (!activated.success) return activated;

  return { success: true, data: { userId, created } };
}
