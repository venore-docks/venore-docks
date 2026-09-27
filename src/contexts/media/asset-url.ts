import { createHmac, timingSafeEqual } from "node:crypto";
import { storagePort } from "@/infrastructure/storage";
import type { MediaVisibility } from "./contracts/types";

// Rota do app que serve um asset por id, com autorização (src/app/api/media/asset/[id]).
export const MEDIA_ASSET_ROUTE = "/api/media/asset";

// URL que o sistema entrega pra um asset. Público + storage servível publicamente = URL direta do
// storage (CDN, sem passar pela função). Qualquer outro caso = rota autorizada do app — antes o
// asset "private" tinha a mesma URL pública do Blob que um público (visibilidade só filtrava
// listagem), e currículo enviado em vaga ficava acessível a quem tivesse o link.
export function resolveAssetUrl(asset: { id: string; pathname: string; visibility: MediaVisibility }): string {
  if (asset.visibility === "public" && storagePort.servesPublicly()) {
    return storagePort.resolveUrl(asset.pathname);
  }
  return `${MEDIA_ASSET_ROUTE}/${asset.id}`;
}

function signingKey(): string {
  const secret = process.env.MEDIA_URL_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("Defina AUTH_SECRET (ou MEDIA_URL_SECRET) para assinar URLs de mídia.");
  }
  return secret;
}

function sign(id: string, expiresAt: number): string {
  return createHmac("sha256", signingKey()).update(`media:${id}:${expiresAt}`).digest("base64url");
}

// URL temporária pra um asset não público, pra quem JÁ foi autorizado por outro caminho (ex:
// revisor de uma entrega com permissão do plugin, sem media.manage). Expira sozinha.
export function createSignedMediaUrl(id: string, ttlSeconds = 60 * 60): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${MEDIA_ASSET_ROUTE}/${id}?exp=${expiresAt}&sig=${sign(id, expiresAt)}`;
}

export function verifyMediaSignature(id: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expiresAt = Number(exp);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(id, expiresAt));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
