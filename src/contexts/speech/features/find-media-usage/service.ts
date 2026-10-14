import type { OperationResult } from "@/shared/types";
import { findClipsByMediaAssetId } from "../../shared/store";

export type SpeechMediaUsage = { scope: string; itemKey: string; locale: string };

// Para o aviso de "arquivo em uso" da biblioteca de mídia (platform/media-usage).
export async function findSpeechMediaUsage(mediaId: string): Promise<OperationResult<SpeechMediaUsage[]>> {
  return { success: true, data: await findClipsByMediaAssetId(mediaId) };
}
