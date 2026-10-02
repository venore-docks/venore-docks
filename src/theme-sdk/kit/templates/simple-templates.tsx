import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Settings2 } from "lucide-react";
import type { HeaderBrand } from "@/contexts/themes/contracts/types";
import type {
  AccountTemplateProps,
  HomeTemplateProps,
  LoginTemplateProps,
  NotFoundTemplateProps,
} from "@/contexts/themes/contracts/v8";
import { Button } from "@/components/ui/button";
import { t } from "../i18n/t";
import { KitEmptyState } from "../states/empty-state";
import { KitLoadingState } from "../states/page-state";
import { templateText } from "./template-strings";

// Home do kit (spec §2.7). Com entry "home" visível: o conteúdo dela (composição ou corpo). Sem:
// o painel de antes da v8 — nome do site, ação principal (ex: "Ver como aluno"), a vitrine de
// plugin (outlet home.showcase) ou o estado vazio, e os atalhos de admin.
export function KitHomeTemplate(props: HomeTemplateProps) {
  const { entry, content, showcase, adminShortcuts, jsonLd, outlets, strings } = props;
  if (entry && content) {
    return (
      <div className="space-y-6">
        {outlets.before}
        <Suspense fallback={<KitLoadingState strings={strings} />}>{content}</Suspense>
        {outlets.after}
        {jsonLd}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{props.siteName ?? ""}</h1>
        {props.primaryAction && (
          <Button asChild size="sm" variant="outline">
            <Link href={props.primaryAction.href}>
              {props.primaryAction.label} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      {outlets.before}
      {showcase ?? (
        <KitEmptyState
          icon={<BookOpen className="size-8" strokeWidth={1.5} />}
          title={templateText(strings, "home.empty.title")}
          description={templateText(strings, "home.empty.message")}
        />
      )}
      {outlets.after}

      {adminShortcuts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {adminShortcuts.map((shortcut) => (
            <Button key={shortcut.href} asChild variant="ghost" size="sm">
              <Link href={shortcut.href} className="text-muted-foreground/56">
                {shortcut.icon === "settings" && <Settings2 className="size-4" strokeWidth={1.5} />}
                {shortcut.icon === "settings" && " "}
                {shortcut.label}
              </Link>
            </Button>
          ))}
        </div>
      )}
      {jsonLd}
    </div>
  );
}

export function KitAccountTemplate({ title, sections, outlets, subtitle }: AccountTemplateProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {outlets.before}
      {sections}
      {outlets.after}
    </div>
  );
}

function LoginBrand({ brand }: { brand: HeaderBrand }): ReactNode {
  if (brand.mode === "text") return <span className="block text-lg font-semibold text-foreground">{brand.name}</span>;
  if (brand.mode === "png") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logoUrl} alt={brand.name} className="mx-auto h-12 w-auto object-contain" />;
  }
  return (
    <span
      role="img"
      aria-label={brand.name}
      className="mx-auto block h-12 w-48 bg-foreground"
      style={{
        maskImage: `url('${brand.logoUrl}')`,
        WebkitMaskImage: `url('${brand.logoUrl}')`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

// Login (grupo (auth), fora da Shell): cartão central com a marca, título e o formulário do core.
export function KitLoginTemplate({ brand, form, footer, outlets, strings }: LoginTemplateProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">
        <div className="space-y-3 text-center">
          <LoginBrand brand={brand} />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{templateText(strings, "login.title")}</h1>
            <p className="text-sm text-muted-foreground">{templateText(strings, "login.subtitle")}</p>
          </div>
        </div>
        {outlets.before}
        {form}
        {outlets.after}
      </div>
      {footer}
    </main>
  );
}

export function KitNotFoundTemplate({ homeHref, strings, outlets }: NotFoundTemplateProps) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-panel border border-border bg-card p-8 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-foreground">{t(strings, "notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t(strings, "notFound.message")}</p>
      {outlets.before}
      <Link href={homeHref} className="text-sm text-primary underline">
        {t(strings, "notFound.home")}
      </Link>
      {outlets.after}
    </div>
  );
}
