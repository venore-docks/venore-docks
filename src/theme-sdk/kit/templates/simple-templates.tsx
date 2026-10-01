import Link from "next/link";
import type {
  AccountTemplateProps,
  HomeTemplateProps,
  LoginTemplateProps,
  NotFoundTemplateProps,
} from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// Templates do kit para home, conta, login e 404. Dono: W4 (liga as páginas a renderTemplate e
// fecha o snapshot de paridade de cada uma).
export function KitHomeTemplate({ content, showcase, adminShortcuts, jsonLd, outlets }: HomeTemplateProps) {
  return (
    <div className="space-y-6">
      {outlets.before}
      {content ?? showcase}
      {adminShortcuts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {adminShortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href} className="text-sm text-muted-foreground/56">
              {shortcut.label}
            </Link>
          ))}
        </div>
      )}
      {outlets.after}
      {jsonLd}
    </div>
  );
}

export function KitAccountTemplate({ title, sections, outlets }: AccountTemplateProps) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      {outlets.before}
      {sections}
      {outlets.after}
    </div>
  );
}

export function KitLoginTemplate({ form, footer }: LoginTemplateProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">{form}</div>
      {footer}
    </main>
  );
}

export function KitNotFoundTemplate({ homeHref, strings }: NotFoundTemplateProps) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-panel border border-border bg-card p-8 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-foreground">{t(strings, "notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t(strings, "notFound.message")}</p>
      <Link href={homeHref} className="text-sm text-primary underline">
        {t(strings, "notFound.home")}
      </Link>
    </div>
  );
}
