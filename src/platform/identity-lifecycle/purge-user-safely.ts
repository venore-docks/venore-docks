import { purgeUser } from "@/contexts/auth";
import { countCmsEntriesByAuthor } from "@/contexts/cms";
import { countAssetsByUploader } from "@/contexts/media";
import type { OperationResult } from "@/shared/types";

export type PurgeUserSafelyInput = { targetUserId: string };

// Ponto de composição fora de auth/cms/media (regra 12/14, mesmo raciocínio de
// purge-media-safely.ts) — auth não pode importar cms nem media, então quem confirma ausência de
// conteúdo antes do hard delete é aqui, não dentro de purgeUser. Sem opção de forçar: apagar a
// conta de verdade com conteúdo/mídia associados quebraria a FK de auth.users no banco de
// qualquer forma (cms.entries.author_id / media.assets.uploaded_by sem onDelete).
export async function purgeUserSafely(input: PurgeUserSafelyInput): Promise<OperationResult<{ id: string }>> {
  const [entriesCount, assetsCount] = await Promise.all([
    countCmsEntriesByAuthor({ authorId: input.targetUserId }),
    countAssetsByUploader({ uploaderId: input.targetUserId }),
  ]);

  const parts: string[] = [];
  if (entriesCount.success && entriesCount.data > 0) {
    parts.push(`${entriesCount.data} entrada${entriesCount.data === 1 ? "" : "s"} de CMS`);
  }
  if (assetsCount.success && assetsCount.data > 0) {
    parts.push(`${assetsCount.data} arquivo${assetsCount.data === 1 ? "" : "s"} de mídia`);
  }

  if (parts.length > 0) {
    return {
      success: false,
      error: {
        code: "auth.purge.still_referenced",
        message: `Esta conta ainda tem ${parts.join(" e ")} associados — reatribua ou apague esse conteúdo antes de apagar a conta definitivamente.`,
      },
    };
  }

  return purgeUser({ targetUserId: input.targetUserId });
}
