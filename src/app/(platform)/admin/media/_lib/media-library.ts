import type { MediaKind, MediaSort, MediaVisibility } from "@/contexts/media";

export const KIND_LABELS: Record<MediaKind, string> = {
  image: "Imagens",
  video: "Vídeos",
  audio: "Áudios",
  document: "Documentos",
};

export const SORT_LABELS: Record<MediaSort, string> = {
  newest: "Mais recentes",
  oldest: "Mais antigos",
  name: "Nome (A–Z)",
  size: "Maiores primeiro",
};

export const VISIBILITY_LABELS: Record<MediaVisibility, string> = {
  public: "Público",
  private: "Privado",
  restricted: "Restrito",
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function kindOfContentType(contentType: string): MediaKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return "document";
}

// Rótulo curto do formato ("PDF", "PNG", "MP4") pra mostrar no lugar da miniatura.
export function formatLabelOf(contentType: string, filename: string): string {
  const extension = filename.includes(".") ? filename.split(".").pop() : undefined;
  if (extension && extension.length <= 5) return extension.toUpperCase();
  return (contentType.split("/")[1] ?? "arquivo").slice(0, 5).toUpperCase();
}

export type LibraryParams = {
  category?: string;
  q?: string;
  kind?: string;
  visibility?: string;
  sort?: string;
  view?: string;
  page?: string;
};

// Monta /admin/media?... preservando só o que tem valor; `overrides` com undefined remove a chave.
export function libraryHref(
  current: LibraryParams,
  overrides: Partial<Record<keyof LibraryParams, string | undefined>> = {},
): string {
  const merged: LibraryParams = { ...current, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/media?${query}` : "/admin/media";
}
