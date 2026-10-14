import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { extractEntryComposition, getEntry, getEntryBody } from "@/contexts/cms";
import { verifyPreviewToken } from "@/platform/cms-preview/preview-token";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

export const dynamic = "force-dynamic";

// Pré-visualização por link assinado (platform/cms-preview): mostra a versão atual da entry em
// qualquer status, sem sessão. Nunca indexada.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function DraftPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const verified = verifyPreviewToken(decodeURIComponent((await params).token));
  if (!verified) notFound();

  const result = await getEntry({ id: verified.entryId });
  const entry = result.success ? result.data : null;
  if (!entry) notFound();

  const composition = extractEntryComposition(entry.data);

  return (
    <article className="space-y-6">
      <p role="note" className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Eye className="size-3.5" aria-hidden="true" />
        Pré-visualização{entry.status === "published" ? "" : " — este conteúdo ainda não está publicado"}. Link válido até{" "}
        {formatDate(verified.expiresAt, DEFAULT_DATE_LOCALE, "dateTimeSeconds")}.
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{entry.title}</h1>
      {composition ? <BlockRenderer blocks={composition} mode="published" /> : <p className="text-muted-foreground">{getEntryBody(entry.data)}</p>}
    </article>
  );
}
