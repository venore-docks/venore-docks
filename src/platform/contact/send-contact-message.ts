import { emailPort } from "@/infrastructure/email";
import type { OperationResult } from "@/shared/types";
import { openContactToken } from "./contact-token";

export type ContactMessageInput = {
  token: string;
  name: string;
  email: string;
  message: string;
  // Campo invisível (honeypot): pessoa não preenche, robô preenche.
  website: string;
  turnstileToken: string | null;
  ip: string;
  pageUrl: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 120, email: 320, message: 5000 };

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY ?? "", response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

// Formulário de contato do page builder: valida, confere captcha (se configurado) e manda por
// e-mail ao destinatário cifrado no token. "reply-to" = quem escreveu.
export async function sendContactMessage(input: ContactMessageInput): Promise<OperationResult<{ sent: true }>> {
  const fail = (code: string, message: string) => ({ success: false as const, error: { code, message } });

  // Robô: finge que deu certo (não ensina a contornar).
  if (input.website.trim()) return { success: true, data: { sent: true } };

  const target = openContactToken(input.token);
  if (!target) return fail("contact.invalid_form", "Formulário expirado. Recarregue a página e tente de novo.");
  if (!emailPort.isEnabled()) return fail("contact.unavailable", "O envio de mensagens não está disponível no momento.");

  const name = input.name.trim().slice(0, LIMITS.name);
  const email = input.email.trim().slice(0, LIMITS.email);
  const message = input.message.trim().slice(0, LIMITS.message);
  if (!name) return fail("contact.invalid_name", "Informe seu nome.");
  if (!EMAIL_PATTERN.test(email)) return fail("contact.invalid_email", "Informe um e-mail válido.");
  if (message.length < 5) return fail("contact.invalid_message", "Escreva sua mensagem.");

  if (!(await verifyTurnstile(input.turnstileToken, input.ip))) {
    return fail("contact.captcha", "Não foi possível confirmar que você não é um robô. Tente de novo.");
  }

  const sent = await emailPort.send({
    to: target.recipient,
    replyTo: email,
    subject: `Contato pelo site: ${name}`,
    text: `${message}\n\n— ${name} <${email}>${input.pageUrl ? `\nEnviado de: ${input.pageUrl}` : ""}`,
  });
  if (!sent.sent) return fail("contact.send_failed", "Não foi possível enviar agora. Tente de novo em instantes.");
  return { success: true, data: { sent: true } };
}
