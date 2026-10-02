"use server";

import { authorizeActor } from "@/contexts/rbac";

// A galeria (W10) desenha regiões reais do kit/tema — sair, trocar nav do admin, colapsar a rail —
// cujos callbacks precisam ser server actions num Server Component. Na vitrine nenhum deles faz
// nada: a galeria nunca grava (nem ativa tema, nem muda preferência).
export async function galleryNoopAction(): Promise<void> {
  await authorizeActor("settings.manage");
}
