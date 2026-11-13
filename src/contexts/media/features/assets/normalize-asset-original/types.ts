import type { OperationResult } from "@/shared/types";

export type NormalizeAssetOriginalCommand = {
  assetId: string;
};

// changed = o original foi trocado no storage (e a linha atualizada). data = bytes que estão no
// storage agora, quando foi preciso lê-los — quem chama repassa pra generateAssetVariants em vez
// de baixar o arquivo de novo. null quando o tipo nem é foto (vídeo, PDF: nada foi lido).
export type NormalizeAssetOriginalResult = OperationResult<{ changed: boolean; data: Buffer | null }>;
