"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  listAvailableAuthProviders,
  registerWithPassword,
  requestPasswordReset,
  resetPasswordWithToken,
  signIn,
  signOut,
} from "@/contexts/auth";
import { isBlockedAccountCode, isMfaLoginCode } from "@/contexts/auth/contracts/login-errors";
import { checkRateLimit, getClientIp } from "@/infrastructure/rate-limit";
import { toSafeCallbackUrl } from "@/platform/auth-flow/safe-callback-url";
import { bootstrapSuperadmin } from "@/platform/registration/bootstrap-superadmin";
import { handleUserRegistered } from "@/platform/registration/handle-user-registered";
import { acceptInvitation } from "@/platform/registration/invitations";
import { isSelfRegistrationEnabled } from "@/platform/registration/registration-settings";
import { getSiteOrigin } from "@/platform/seo/site-origin";

// Limites por IP e por e-mail — força bruta de senha, credential stuffing e spam de cadastro.
const LOGIN_IP_LIMIT = { limit: 30, windowMs: 15 * 60 * 1000 };
const LOGIN_EMAIL_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
const REGISTER_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
const RESET_REQUEST_IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const RESET_REQUEST_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
const RESET_SUBMIT_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

async function clientIp(): Promise<string> {
  return getClientIp(await headers());
}

function postLoginPath(callbackUrl: string | null): string {
  return callbackUrl ? `/post-login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/post-login";
}

function loginPath(params: Record<string, string>, callbackUrl: string | null): string {
  const search = new URLSearchParams(params);
  if (callbackUrl) search.set("callbackUrl", callbackUrl);
  return `/login?${search.toString()}`;
}

export async function signInWithProviderAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const callbackUrl = toSafeCallbackUrl(formData.get("callbackUrl"));
  // Só provider OAuth habilitado — nunca um id arbitrário vindo do form.
  const enabled = listAvailableAuthProviders().some((entry) => entry.kind === "oauth" && entry.enabled && entry.key === provider);
  if (!enabled) return;

  await signIn(provider, { redirectTo: postLoginPath(callbackUrl) });
}

export async function signInWithPasswordAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const otp = String(formData.get("otp") ?? "").trim();
  const callbackUrl = toSafeCallbackUrl(formData.get("callbackUrl"));

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`auth.login.ip:${ip}`, LOGIN_IP_LIMIT),
    checkRateLimit(`auth.login.email:${username.toLowerCase()}`, LOGIN_EMAIL_LIMIT),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    redirect(loginPath({ error: "too-many-attempts" }, callbackUrl));
  }

  try {
    await signIn("credentials", { username, password, otp, redirect: false });
  } catch (error) {
    // Status da conta (pendente, congelada...) só chega aqui quando a senha estava CERTA — o
    // authorize() recusa com um código específico depois do verify (contracts/login-errors.ts).
    if (error instanceof CredentialsSignin && (isBlockedAccountCode(error.code) || isMfaLoginCode(error.code))) {
      redirect(loginPath({ error: error.code }, callbackUrl));
    }
    if (error instanceof AuthError) {
      redirect(loginPath({ error: "invalid-credentials" }, callbackUrl));
    }
    throw error;
  }

  redirect(postLoginPath(callbackUrl));
}

// Registro por senha (provider Credentials). A conta nasce "pending" (fail-closed) e a
// composição de registro decide se libera (aprovação desligada) — mesma composição do evento
// `createUser` do Auth.js pro OAuth.
export async function signUpWithPasswordAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!(await isSelfRegistrationEnabled())) {
    redirect(loginPath({ error: "registration-closed" }, null));
  }

  const limit = await checkRateLimit(`auth.register.ip:${await clientIp()}`, REGISTER_IP_LIMIT);
  if (!limit.allowed) {
    redirect(loginPath({ error: "too-many-attempts" }, null));
  }

  const registered = await registerWithPassword({ name, email, password });
  if (!registered.success) {
    // E-mail já cadastrado responde igual a um cadastro recebido — não confirma a terceiros
    // quais e-mails têm conta. Os demais erros são de formato (a pessoa precisa corrigir).
    if (registered.error.code === "auth.registration.email_taken") {
      redirect(loginPath({ notice: "registration-received" }, null));
    }
    redirect(loginPath({ error: registered.error.code }, null));
  }

  const composed = await handleUserRegistered({
    id: registered.data.id,
    email: registered.data.email,
    name: registered.data.name,
  });
  if (!composed.success) {
    // Fail-closed: a conta continua pendente; um admin pode aprovar depois.
    redirect(loginPath({ notice: "registration-received" }, null));
  }

  // Aprovação desligada: já entra. Aprovação exigida: authorize() recusa com account_pending.
  try {
    await signIn("credentials", { username: email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(loginPath({ notice: "registration-received" }, null));
    }
    throw error;
  }

  redirect("/post-login");
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

export type SetupActionState = { error: string | null };

// Primeiro superadmin via /setup, gated por SETUP_TOKEN (platform/registration/bootstrap-superadmin.ts).
export async function bootstrapSuperadminAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const token = String(formData.get("token") ?? "");
  const mode = formData.get("mode") === "create" ? "create" : "session";
  const clientIpValue = await clientIp();

  const result =
    mode === "create"
      ? await bootstrapSuperadmin({
          mode,
          token,
          clientIp: clientIpValue,
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        })
      : await bootstrapSuperadmin({ mode, token, clientIp: clientIpValue });

  if (!result.success) {
    return { error: result.error.message };
  }

  if (result.data.created) {
    try {
      await signIn("credentials", {
        username: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) redirect("/login");
      throw error;
    }
  }
  redirect("/admin");
}

export type PasswordResetActionState = { error: string | null };

// "Esqueci minha senha": resposta igual exista ou não a conta (a página diz "se houver conta...").
export async function requestPasswordResetAction(
  _prev: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ipLimit = await checkRateLimit(`auth.reset-request.ip:${await clientIp()}`, RESET_REQUEST_IP_LIMIT);
  const emailLimit = await checkRateLimit(`auth.reset-request.email:${email}`, RESET_REQUEST_EMAIL_LIMIT);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const result = await requestPasswordReset({ email, resetUrl: `${await getSiteOrigin()}/reset-password` });
  if (!result.success) {
    return { error: result.error.message };
  }
  redirect("/forgot-password?enviado=1");
}

export async function resetPasswordAction(_prev: PasswordResetActionState, formData: FormData): Promise<PasswordResetActionState> {
  const newPassword = String(formData.get("password") ?? "");
  if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
    return { error: "A confirmação não bate com a nova senha." };
  }
  const limit = await checkRateLimit(`auth.reset-submit.ip:${await clientIp()}`, RESET_SUBMIT_IP_LIMIT);
  if (!limit.allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const result = await resetPasswordWithToken({ token: String(formData.get("token") ?? ""), newPassword });
  if (!result.success) {
    return { error: result.error.message };
  }
  redirect(loginPath({ notice: "password-reset" }, null));
}

export type AcceptInvitationActionState = { error: string | null };

const INVITE_ACCEPT_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

// Aceitar convite: cria a conta (já aprovada, com o papel do convite) e manda pro login.
export async function acceptInvitationAction(
  _prev: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    return { error: "A confirmação não bate com a senha." };
  }
  const limit = await checkRateLimit(`auth.invite-accept.ip:${await clientIp()}`, INVITE_ACCEPT_IP_LIMIT);
  if (!limit.allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  const result = await acceptInvitation({
    token: String(formData.get("token") ?? ""),
    name: String(formData.get("name") ?? ""),
    password,
  });
  if (!result.success) {
    return { error: result.error.message };
  }
  redirect(loginPath({ notice: "invitation-accepted" }, null));
}
