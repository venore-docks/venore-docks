import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import type { EntryTemplateProps } from "@/contexts/themes/contracts/v8";
import { KitLoadingState } from "../states/page-state";
import { formatEntryDate } from "./template-strings";

// Template de entry do kit — o mesmo markup que [...slug]/page.tsx renderizava antes da v8
// (snapshot: src/app/(platform)/__parity__/entry-*.html). Sem max-w/mx-auto próprios: a moldura
// de conteúdo já centra (alinhado com a trilha de breadcrumb).
export function KitEntryTemplate({ entry, content, backLink, jsonLd, outlets, locale, strings }: EntryTemplateProps) {
  const publishedLabel = formatEntryDate(entry.publishedAt, locale);
  return (
    <article className="space-y-6">
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> {backLink.label}
        </Link>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{entry.title}</h1>
        {publishedLabel && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" /> {publishedLabel}
          </p>
        )}
      </div>

      {outlets.before}
      {/* Título e data saem antes; um bloco lento (renderer de tema, dado de plugin) faz stream. */}
      <Suspense fallback={<KitLoadingState strings={strings} />}>{content}</Suspense>
      {outlets.after}
      {jsonLd}
    </article>
  );
}
