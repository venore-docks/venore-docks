import type { MediaAsset, MediaVisibility } from "@/contexts/media/contracts/types";
import type { OperationResult } from "@/shared/types";

export type RegisterUploadedMediaCommand = {
  // Nome original do arquivo (o browser já sabe, não precisa ir e voltar pelo ticket) — ver
  // contracts/types.ts MediaAsset.filename.
  filename: string;
  pathname: string;
  // Ignorada: a URL é sempre derivada do storage + visibilidade (asset-url.ts). Mantida no tipo
  // só por compatibilidade com quem ainda envia (o cliente podia registrar QUALQUER URL como mídia).
  url?: string;
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
  // true só quando o checksum foi calculado pelo SERVIDOR a partir dos bytes (webhook
  // onUploadCompleted). Checksum informado pelo browser não é confiável e não entra na
  // deduplicação — senão um upload "reaproveitava" o registro de outro arquivo.
  checksumVerified?: boolean;
};

export type RegisterUploadedMediaResult = OperationResult<MediaAsset>;
