import type { OperationResult } from "@/shared/types";

export type GenerateAssetVariantsCommand = {
  assetId: string;
  // Bytes do original quando quem chama já tem em memória (upload server-buffered) — evita baixar
  // de novo do storage. Ausente = lê do storage (upload direto ao Blob, backfill).
  data?: Buffer;
};

// generated = quantas variantes novas foram gravadas agora. skipped = o asset não é imagem que dê
// pra reduzir (ou já tinha todas), nada a fazer.
export type GenerateAssetVariantsResult = OperationResult<{ generated: number; skipped: boolean }>;
