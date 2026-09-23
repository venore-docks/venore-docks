// "public": qualquer ator autenticado vê e usa. "restricted": só o contexto de origem — hoje é
// só um rótulo administrativo, o enforcement de "só consumível onde foi enviado" ainda não existe
// (Known Gap, docs/implementation-roadmap.md Fase 4/M3). "private": só dono + media.manage;
// avatar nasce sempre assim.
export type MediaVisibility = "public" | "restricted" | "private";

// Categoria de organização de um asset — classificação escolhida pelo admin (ex: "Marketing",
// "avatars"), não a classificação técnica de mimeType (MediaAssetCategory, abaixo). Um asset tem
// no máximo uma (ver database/schema/index.ts, comentário em assets.categoryId).
export type MediaCategory = {
  id: string;
  key: string;
  name: string;
  createdAt: Date;
};

// Único sistema de mídia do projeto (docs/implementation-roadmap.md, Fase 4/M1-M3) — `files`
// (storage local em disco, só funcionava em dev) foi descontinuado, tudo passa por
// `assets`+Vercel Blob (docs/media/blob-spec.md).
export type MediaAsset = {
  id: string;
  filename: string;
  pathname: string;
  url: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  checksum: string;
  // Nullable — envio anônimo (ex: uploadReservedCategoryAssetPublic) não tem ator autenticado.
  uploadedBy: string | null;
  visibility: MediaVisibility;
  categoryId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaAssetCategory = "image" | "document" | "video" | "audio";

export type MediaAllowedTypeRule = {
  category: MediaAssetCategory;
  maxSizeBytes: number;
};

// Allowlist (nunca blocklist) — blob-spec seção 5. `image/svg+xml` pode carregar script
// embutido (risco de XSS), então só é aceito pelo upload server-buffered
// (uploadMediaAsset/uploadAvatarMediaAsset/uploadActivitySubmissionMediaAsset), nunca pelo
// ticket de upload direto ao Blob — o servidor nunca vê os bytes nesse fluxo antes do arquivo já
// estar público no storage, então não haveria onde sanitizar (ver
// assertTypeAllowedForDirectUpload em request-media-upload-ticket/service.ts). Os bytes passam
// por sanitizeSvgBuffer (sanitize-svg-buffer.ts) antes de chegar em storagePort.store — cap de
// tamanho bem menor que os outros formatos de imagem porque SVG é texto.
export const MEDIA_ALLOWED_TYPES: Record<string, MediaAllowedTypeRule> = {
  "image/png": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/jpeg": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/webp": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/gif": { category: "image", maxSizeBytes: 8 * 1024 * 1024 },
  "image/svg+xml": { category: "image", maxSizeBytes: 2 * 1024 * 1024 },
  "application/pdf": { category: "document", maxSizeBytes: 20 * 1024 * 1024 },
  "video/mp4": { category: "video", maxSizeBytes: 200 * 1024 * 1024 },
  "video/webm": { category: "video", maxSizeBytes: 200 * 1024 * 1024 },
  "audio/mpeg": { category: "audio", maxSizeBytes: 20 * 1024 * 1024 },
  "audio/wav": { category: "audio", maxSizeBytes: 20 * 1024 * 1024 },
  "audio/ogg": { category: "audio", maxSizeBytes: 20 * 1024 * 1024 },
};

// Limite próprio do upload de avatar — bem mais restrito que o teto geral de imagem em
// MEDIA_ALLOWED_TYPES (8 MiB), porque avatar é servido em toda a UI a cada render.
export const AVATAR_MAX_SIZE_BYTES = 500 * 1024;

// Categoria reservada auto-atribuída pelo upload de avatar (Fase 4/M1 — "pasta" de sistema,
// primeiro caso concreto de herança de categoria por contexto de upload). É o único caso
// reservado do core; um plugin que precise de upload numa categoria reservada própria (entregas,
// anexos) traz o próprio handler + constantes no seu domínio.
export const AVATAR_RESERVED_CATEGORY_KEY = "avatars";
export const AVATAR_RESERVED_CATEGORY_NAME = "Avatares";
