import type { MediaAsset, MediaVisibility } from "@/contexts/media/contracts/types";
import type { OperationResult } from "@/shared/types";

export type RegisterUploadedMediaCommand = {
  // Nome original do arquivo (o browser já sabe, não precisa ir e voltar pelo ticket) — ver
  // contracts/types.ts MediaAsset.filename.
  filename: string;
  pathname: string;
  url: string;
  contentType: string;
  size: number;
  checksum: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  // Omitido = "private" (mesmo default da coluna) — quem confirma o upload direto ao Blob sem
  // opinião sobre visibilidade (ex: MediaPickerField, que já força "public" no input em vez de
  // deixar aqui implícito) continua se comportando como antes desta option ser adicionada.
  visibility?: MediaVisibility;
  actorId: string;
};

export type RegisterUploadedMediaResult = OperationResult<MediaAsset>;
