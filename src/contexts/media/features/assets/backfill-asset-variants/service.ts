import { beginOperation, endOperation } from "@/observability";
import { generateAssetVariants } from "../generate-asset-variants/service";
import { countAssetsPendingVariants, findAssetIdsPendingVariants } from "./store";
import type { BackfillAssetVariantsCommand, BackfillAssetVariantsResult } from "./types";

// Gera variantes pros assets enviados antes delas existirem (ou cuja geração falhou), um lote por
// chamada — lote pequeno cabe folgado no tempo de uma função serverless mesmo com foto de 8 MB.
// Asset que falha continua pendente e volta no próximo lote; quem chama (botão do admin) para
// quando um lote inteiro só falhou, pra um arquivo corrompido não prender o botão num loop.
export async function backfillAssetVariants(command: BackfillAssetVariantsCommand & { actorId: string }): Promise<BackfillAssetVariantsResult> {
  const handle = beginOperation({
    useCase: "media.backfill-asset-variants",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const ids = await findAssetIdsPendingVariants(command.limit);
  let generated = 0;
  let failed = 0;
  for (const assetId of ids) {
    const result = await generateAssetVariants({ assetId });
    if (result.success) generated += result.data.generated;
    else failed += 1;
  }

  const remaining = await countAssetsPendingVariants();
  endOperation(handle, { success: true });
  return { success: true, data: { processed: ids.length, generated, failed, remaining } };
}
