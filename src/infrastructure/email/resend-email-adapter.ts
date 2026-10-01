import type { EmailMessage, EmailPort, EmailSendResult } from "./email-port";

// Resend via HTTP (sem SDK): POST https://api.resend.com/emails. Custo e plano em
// docs/custos-melhorias-e-recursos.md.
export class ResendEmailAdapter implements EmailPort {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return { sent: false, reason: `Resend respondeu HTTP ${response.status}.` };
      }
      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { sent: true, id: body.id ?? null };
    } catch (error) {
      return { sent: false, reason: error instanceof Error ? error.message : "Falha de rede ao enviar e-mail." };
    }
  }
}
