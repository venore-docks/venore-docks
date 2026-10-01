import { getCurrentUser } from "@/contexts/auth";
import { getUserContext } from "@/contexts/rbac";

// isSuperadmin/permissions: arquivo "restricted" decide por permission própria, não por
// media.manage (shared/can-read-asset.ts).
export type MediaActorScope = { actorId: string; isMediaAdmin: boolean; isSuperadmin: boolean; permissions: readonly string[] };

// Resolve "quem está perguntando" pra filtragem de visibilidade em list-media/get-media — não é
// gate de permissão (nunca falha), só o contexto que o store usa pra decidir o que mostrar.
// `null` = sem sessão, equivalente a "não enxerga nada" pro chamador (mesma resposta de "não
// encontrado" usada pra asset privado de outro ator, nunca "sem permissão").
export async function resolveMediaActorScope(): Promise<MediaActorScope | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) {
    return null;
  }

  const context = await getUserContext({ userId: currentUser.data.id });
  const isSuperadmin = context.success && context.data.isSuperadmin;
  const permissions = context.success ? context.data.permissions : [];
  const isMediaAdmin = isSuperadmin || permissions.includes("media.manage");

  return { actorId: currentUser.data.id, isMediaAdmin, isSuperadmin, permissions };
}
