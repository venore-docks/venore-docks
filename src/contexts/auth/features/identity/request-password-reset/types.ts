import type { OperationResult } from "@/shared/types";

// resetUrl: endereço absoluto de /reset-password (quem chama resolve a origem do site); o token vai
// como ?token=.
export type RequestPasswordResetInput = { email: string; resetUrl: string };
// Sempre "ok" quando o envio está configurado — não revela se o e-mail tem conta.
export type RequestPasswordResetResult = OperationResult<{ accepted: true }>;
