import type { OperationResult } from "@/shared/types";

export type BackfillAssetVariantsCommand = { limit: number };

// remaining = quantos ainda faltam DEPOIS deste lote — o botão do admin repete até chegar a 0.
export type BackfillAssetVariantsResult = OperationResult<{
  processed: number;
  generated: number;
  failed: number;
  remaining: number;
}>;
