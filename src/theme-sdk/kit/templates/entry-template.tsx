import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import type { EntryTemplateProps } from "@/contexts/themes/contracts/v8";

// Template de entry do kit — mesmo JSX que [...slug]/page.tsx renderiza hoje. Dono: W4, que liga
// a página a renderTemplate("entry") e fecha o snapshot de paridade
// (src/app/(platform)/__parity__/entry-*.html).
export function KitEntryTemplate({ entry, content, backLink, jsonLd, outlets }: EntryTemplateProps) {
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
        {entry.publishedAt && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" /> {entry.publishedAt}
          </p>
        )}
      </div>

      {outlets.before}
      {content}
      {outlets.after}
      {jsonLd}
    </article>
  );
}
