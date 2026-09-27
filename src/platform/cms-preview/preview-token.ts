import { createHmac, timingSafeEqual } from "node:crypto";

// Link de pré-visualização de rascunho: token = <entryId>.<expiraEm>.<assinatura>, assinado com
// AUTH_SECRET. Sem tabela: vale até expirar (não dá pra revogar um link específico — trocar o
// AUTH_SECRET invalida todos). Quem tem o link vê a versão ATUAL da entry, em qualquer status.
export const PREVIEW_ROUTE = "/visualizar-rascunho";
export const PREVIEW_TTL_OPTIONS_HOURS = [24, 72, 168] as const;

function secret(): string {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ausente — não dá pra assinar link de pré-visualização.");
  return value;
}

function sign(entryId: string, expiresAt: number): string {
  return createHmac("sha256", secret()).update(`cms-preview:${entryId}:${expiresAt}`).digest("base64url");
}

export function createPreviewToken(entryId: string, ttlHours: number, now = Date.now()): { token: string; expiresAt: Date } {
  const expiresAt = now + ttlHours * 60 * 60 * 1000;
  return { token: `${Buffer.from(entryId).toString("base64url")}.${expiresAt}.${sign(entryId, expiresAt)}`, expiresAt: new Date(expiresAt) };
}

export function verifyPreviewToken(token: string, now = Date.now()): { entryId: string; expiresAt: Date } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedId, expiresRaw, signature] = parts;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;
  let entryId: string;
  try {
    entryId = Buffer.from(encodedId, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!entryId) return null;
  const expected = Buffer.from(sign(entryId, expiresAt));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { entryId, expiresAt: new Date(expiresAt) };
}
