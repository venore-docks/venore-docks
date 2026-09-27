export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Resposta vai pra este endereço (ex: formulário de contato: responder direto a quem escreveu).
  replyTo?: string;
};

export type EmailSendResult = { sent: true; id: string | null } | { sent: false; reason: string };

// Porta de envio de e-mail — o domínio só conhece isto, nunca o provedor (mesma ideia do
// storagePort). Drivers em ./index.ts.
export interface EmailPort {
  // false = nenhum provedor configurado: fluxos que dependem de e-mail (recuperar senha) somem da UI.
  isEnabled(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
