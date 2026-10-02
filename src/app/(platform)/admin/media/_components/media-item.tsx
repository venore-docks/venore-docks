import Link from "next/link";
import { Lock, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MediaVisibility } from "@/contexts/media";
import { DeleteMediaButton } from "./delete-media-button";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaItem({
  id,
  filename,
  url,
  contentType,
  size,
  createdAt,
  visibility,
  categoryName,
}: {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: string;
  visibility: MediaVisibility;
  categoryName: string | null;
}) {
  const isImage = contentType.startsWith("image/");

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-border bg-card p-3">
      <Link href={`/admin/media/${id}`} className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={filename} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground/56">arquivo</span>
        )}
      </Link>
      <Link href={`/admin/media/${id}`} className="truncate text-sm font-medium text-foreground outline-none hover:underline" title={filename}>
        {filename}
      </Link>
      <p className="text-xs text-muted-foreground/56">
        {formatSize(size)} · {formatDate(createdAt, DEFAULT_DATE_LOCALE, "short")}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {/* Reconhecível de relance, sem abrir (docs do pedido): cadeado + cor de destaque, não só
            um texto pequeno cinza igual ao resto da UI. */}
        {visibility === "private" && (
          <Badge variant="destructive">
            <Lock className="size-3" strokeWidth={2} />
            Privado
          </Badge>
        )}
        {visibility === "restricted" && (
          <Badge variant="outline" className="text-warning">
            <ShieldQuestion className="size-3" strokeWidth={2} />
            Restrito
          </Badge>
        )}
        {visibility === "public" && <Badge variant="outline">Público</Badge>}
        {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
      </div>
      <DeleteMediaButton id={id} className="w-full text-destructive" />
    </div>
  );
}
