import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaAsset } from "../../../contracts/types";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import { canReadAsset } from "../../../shared/can-read-asset";

// Lê por id e aplica canReadAsset (a mesma regra da rota que serve o arquivo) — "restricted"
// depende de permission do ator, que não cabe num filtro SQL simples.
export async function findAssetByIdForScope(id: string, scope: MediaActorScope): Promise<MediaAsset | null> {
  const [row] = await db.select().from(assets).where(and(eq(assets.id, id), isNull(assets.deletedAt))).limit(1);
  const asset = (row as MediaAsset | undefined) ?? null;
  return asset && canReadAsset(asset, scope) ? asset : null;
}

// Sem filtro de visibilidade/dono — só chamar de dentro de um service que JÁ verificou sozinho
// que o ator atual pode ver este asset específico (ver getMediaAssetForTrustedReview).
export async function findAssetByIdUnscoped(id: string): Promise<MediaAsset | null> {
  const [row] = await db.select().from(assets).where(and(eq(assets.id, id), isNull(assets.deletedAt))).limit(1);
  return (row as MediaAsset) ?? null;
}

// Visitante sem sessão (resolveMediaActorScope devolve null pra esse caso) — findAssetByIdForScope
// exige um MediaActorScope real (actorId pra comparar com uploadedBy), então não dá pra reusá-la
// aqui. Filtro fixo em "public": bug reportado nesta sessão — páginas públicas (blogroll, home,
// páginas institucionais) renderizavam sem nenhuma imagem pra visitante anônimo, porque
// getMediaAssetHandler devolvia null incondicionalmente sem sessão, mesmo pra asset com
// visibility "public". "private"/"restricted" continuam invisíveis (comportamento correto,
// intocado).
export async function findPublicAssetById(id: string): Promise<MediaAsset | null> {
  const [row] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), isNull(assets.deletedAt), eq(assets.visibility, "public")))
    .limit(1);
  return (row as MediaAsset) ?? null;
}
