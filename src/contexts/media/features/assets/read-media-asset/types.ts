import type { ByteRange } from "@/infrastructure/storage/storage-port";
import type { OperationResult } from "@/shared/types";
import type { MediaVisibility } from "../../../contracts/types";

export type ReadMediaAssetQuery = {
  // Exatamente um dos dois: id (rota /api/media/asset/[id]) ou pathname (rota do driver filesystem).
  id?: string;
  pathname?: string;
  // URL assinada (createSignedMediaUrl) — alternativa à sessão pra quem já foi autorizado.
  exp?: string | null;
  sig?: string | null;
  range?: ByteRange | null;
};

export type ReadMediaAssetView = {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  range: ByteRange | null;
  visibility: MediaVisibility;
};

export type ReadMediaAssetResult = OperationResult<ReadMediaAssetView>;
