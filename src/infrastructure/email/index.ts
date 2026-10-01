import type { EmailMessage, EmailPort, EmailSendResult } from "./email-port";
import { ResendEmailAdapter } from "./resend-email-adapter";

// Drivers (EMAIL_DRIVER):
// - "resend": envio real (RESEND_API_KEY + EMAIL_FROM).
// - "console": só escreve a mensagem no log do servidor — desenvolvimento/teste.
// - ausente/"none": desligado. Recuperação de senha e avisos por e-mail não aparecem.
class ConsoleEmailAdapter implements EmailPort {
  isEnabled(): boolean {
    return true;
  }
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info(`[email:console] Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}`);
    return { sent: true, id: null };
  }
}

class DisabledEmailAdapter implements EmailPort {
  isEnabled(): boolean {
    return false;
  }
  async send(): Promise<EmailSendResult> {
    return { sent: false, reason: "Envio de e-mail não configurado (EMAIL_DRIVER)." };
  }
}

export function createEmailPort(env: Record<string, string | undefined> = process.env): EmailPort {
  switch (env.EMAIL_DRIVER) {
    case "resend": {
      const apiKey = env.RESEND_API_KEY?.trim();
      const from = env.EMAIL_FROM?.trim();
      if (!apiKey || !from) {
        console.warn("[email] EMAIL_DRIVER=resend sem RESEND_API_KEY/EMAIL_FROM — envio desligado.");
        return new DisabledEmailAdapter();
      }
      return new ResendEmailAdapter(apiKey, from);
    }
    case "console":
      return new ConsoleEmailAdapter();
    default:
      return new DisabledEmailAdapter();
  }
}

export const emailPort: EmailPort = createEmailPort();

export type { EmailMessage, EmailPort, EmailSendResult } from "./email-port";
