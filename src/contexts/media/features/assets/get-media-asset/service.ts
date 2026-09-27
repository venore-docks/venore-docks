import { createSignedMediaUrl } from "../../../asset-url";
import { findAssetByIdForScope, findAssetByIdUnscoped } from "./store";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import type { GetMediaAssetQuery, GetMediaAssetResult } from "./types";

export async function getMediaAsset(query: GetMediaAssetQuery, scope: MediaActorScope): Promise<GetMediaAssetResult> {
  const media = await findAssetByIdForScope(query.id, scope);
  return { success: true, data: media };
}

// BYPASS DELIBERADO da visibilidade (public/private/restricted) — existe só pra um caso: o
// professor de um curso (permissão academy.courses.manage, não media.manage) revisando um
// arquivo que o ALUNO enviou como entrega de atividade (sempre "private", dono = aluno). Sem
// isso, o professor nunca conseguiria abrir a entrega (findAssetByIdForScope só libera dono ou
// media.manage — nem "restricted" ajudaria aqui, o enforcement dele nem existe ainda). Só chamar
// isto de dentro de um service que já verificou a própria autorização pro recurso específico
// (hoje: list-lesson-activity-submissions-for-activity, atrás de authorizeActor("academy.
// courses.manage") no handler) — nunca expor direto num handler chamável por qualquer ator.
export async function getMediaAssetForTrustedReview(query: GetMediaAssetQuery): Promise<GetMediaAssetResult> {
  const media = await findAssetByIdUnscoped(query.id);
  if (!media || media.visibility === "public") {
    return { success: true, data: media };
  }
  // O revisor não é dono nem tem media.manage — a URL normal (rota autorizada) recusaria. Uma URL
  // assinada de curta duração libera só este arquivo, só por um tempo.
  return { success: true, data: { ...media, url: createSignedMediaUrl(media.id) } };
}
