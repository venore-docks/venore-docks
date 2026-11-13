import Link from "next/link";
import { FileText, FileAudio, FileVideo, Files, Globe, Lock, ShieldQuestion, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaKind, MediaVisibility } from "@/contexts/media";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";
import { formatLabelOf, formatSize, kindOfContentType, VISIBILITY_LABELS } from "../_lib/media-library";
import { DeleteMediaButton } from "./delete-media-button";
import { MediaItemMenu } from "./media-item-menu";

export type MediaItemProps = {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  visibility: MediaVisibility;
  categoryId: string | null;
  categoryName: string | null;
  categories: { id: string; name: string }[];
};

const KIND_ICONS: Record<MediaKind, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  image: Files,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
};

// Visibilidade reconhecível de relance, sem abrir (docs do pedido): ícone + cor de destaque.
function VisibilityMark({ visibility, withLabel = false }: { visibility: MediaVisibility; withLabel?: boolean }) {
  const config = {
    private: { icon: Lock, tone: "bg-destructive/10 text-destructive" },
    restricted: { icon: ShieldQuestion, tone: "bg-warning/15 text-warning" },
    public: { icon: Globe, tone: "bg-muted text-muted-foreground" },
  }[visibility];
  const Icon = config.icon;
  return (
    <span
      title={VISIBILITY_LABELS[visibility]}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", config.tone)}
    >
      <Icon className="size-3" strokeWidth={2} aria-hidden="true" />
      {withLabel ? VISIBILITY_LABELS[visibility] : <span className="sr-only">{VISIBILITY_LABELS[visibility]}</span>}
    </span>
  );
}

function Thumbnail({ filename, url, contentType, className }: { filename: string; url: string; contentType: string; className?: string }) {
  const kind = kindOfContentType(contentType);
  const Icon = KIND_ICONS[kind];
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted", className)}>
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground/56">
          <Icon className="size-7" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold tracking-wide">{formatLabelOf(contentType, filename)}</span>
        </div>
      )}
    </div>
  );
}

export function MediaCard(props: MediaItemProps) {
  const { id, filename, url, contentType, size, createdAt, visibility, categoryId, categoryName, categories } = props;
  const detailHref = `/admin/media/${id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-panel border border-border bg-card ui-motion-base hover:border-primary/40 focus-within:border-primary/40">
      <Link href={detailHref} aria-label={`Abrir ${filename}`} className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <Thumbnail filename={filename} url={url} contentType={contentType} className="aspect-[4/3]" />
      </Link>

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <span className="pointer-events-auto">{visibility !== "public" && <VisibilityMark visibility={visibility} />}</span>
        <span className="pointer-events-auto flex gap-1 opacity-100 ui-motion-base sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <MediaItemMenu id={id} url={url} categoryId={categoryId} categories={categories} />
          <DeleteMediaButton
            id={id}
            size="icon"
            label={<Trash2 className="size-4" />}
            ariaLabel={`Excluir ${filename}`}
            className="size-7 bg-secondary text-destructive"
          />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <Link href={detailHref} title={filename} className="truncate text-sm font-medium text-foreground outline-none hover:underline">
          {filename}
        </Link>
        <p className="text-xs text-muted-foreground">
          {formatLabelOf(contentType, filename)} · {formatSize(size)} · {formatDate(createdAt, DEFAULT_DATE_LOCALE, "short")}
        </p>
        <p className={cn("mt-auto truncate pt-1 text-xs", categoryName ? "text-primary" : "text-muted-foreground/56")}>
          {categoryName ?? "Sem categoria"}
        </p>
      </div>
    </article>
  );
}

export function MediaRow(props: MediaItemProps) {
  const { id, filename, url, contentType, size, width, height, createdAt, visibility, categoryId, categoryName, categories } = props;
  const detailHref = `/admin/media/${id}`;

  return (
    <li className="flex items-center gap-3 px-3 py-2 ui-motion-base hover:bg-muted/50">
      <Link href={detailHref} aria-label={`Abrir ${filename}`} className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Thumbnail filename={filename} url={url} contentType={contentType} className="size-12 rounded-md" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={detailHref} title={filename} className="block truncate text-sm font-medium text-foreground outline-none hover:underline">
          {filename}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {formatLabelOf(contentType, filename)} · {formatSize(size)}
          {width && height ? ` · ${width}×${height}` : ""}
          <span className="md:hidden"> · {categoryName ?? "Sem categoria"}</span>
        </p>
      </div>

      <p className={cn("hidden w-40 shrink-0 truncate text-xs md:block", categoryName ? "text-primary" : "text-muted-foreground/56")}>
        {categoryName ?? "Sem categoria"}
      </p>
      <p className="hidden w-24 shrink-0 text-xs text-muted-foreground lg:block">{formatDate(createdAt, DEFAULT_DATE_LOCALE, "short")}</p>
      <span className="hidden shrink-0 sm:block">
        <VisibilityMark visibility={visibility} withLabel />
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <MediaItemMenu id={id} url={url} categoryId={categoryId} categories={categories} />
        <DeleteMediaButton
          id={id}
          size="icon"
          label={<Trash2 className="size-4" />}
          ariaLabel={`Excluir ${filename}`}
          className="size-7 text-destructive"
        />
      </div>
    </li>
  );
}
