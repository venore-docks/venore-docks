import { createHmac, timingSafeEqual } from "node:crypto";

// Prova de que a renovação da versão de sessão partiu do servidor. O callback jwt com trigger
// "update" também é disparado pelo cliente (POST /api/auth/session com dados arbitrários) — se ele
// relesse a versão do banco sem prova, uma sessão já revogada se "renovaria" sozinha.
function secret(): string {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ausente — não dá pra assinar a renovação de sessão.");
  return value;
}

export function signSessionVersion(userId: string, sessionVersion: number): string {
  return createHmac("sha256", secret()).update(`session-version:${userId}:${sessionVersion}`).digest("base64url");
}

export function verifySessionVersionProof(userId: string, sessionVersion: number, proof: unknown): boolean {
  if (typeof proof !== "string" || proof.length === 0) return false;
  const expected = Buffer.from(signSessionVersion(userId, sessionVersion));
  const received = Buffer.from(proof);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
