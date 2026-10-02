import type { MediaVisibility } from "../contracts/types";
import type { MediaActorScope } from "../resolve-media-actor-scope";

export type AssetAccessFields = {
  visibility: MediaVisibility;
  uploadedBy: string | null;
  accessPermission: string | null;
};

// Regra única de leitura de um asset por um ator (sem contar URL assinada, que é checada à parte
// por quem serve o arquivo):
// - public: qualquer um;
// - private: dono ou media.manage;
// - restricted: superadmin, dono, ou quem tem a accessPermission do asset. media.manage NÃO basta —
//   é isso que impede o admin do site de abrir currículo pela biblioteca de mídia.
export function canReadAsset(asset: AssetAccessFields, scope: MediaActorScope | null): boolean {
  if (asset.visibility === "public") return true;
  if (!scope) return false;
  const isOwner = asset.uploadedBy !== null && asset.uploadedBy === scope.actorId;
  if (asset.visibility === "restricted") {
    return scope.isSuperadmin || isOwner || (asset.accessPermission !== null && scope.permissions.includes(asset.accessPermission));
  }
  return scope.isMediaAdmin || isOwner;
}

// Mudar visibilidade/categoria de um asset restrito (ou tornar um asset restrito) é só do
// superadmin: senão media.manage tornaria um currículo "public" e o abriria.
export function canManageAsset(asset: AssetAccessFields, scope: { actorId: string; isMediaAdmin: boolean; isSuperadmin: boolean }): boolean {
  if (asset.visibility === "restricted") return scope.isSuperadmin;
  return scope.isMediaAdmin || (asset.uploadedBy !== null && asset.uploadedBy === scope.actorId);
}
