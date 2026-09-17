import Link from "next/link";
import { Sitemap } from "@/components/sitemap";
import type { FooterSlotProps } from "@/contexts/themes/contracts/types";
import { PlatformBrand } from "./PlatformBrand";

// Marca num painel accent-soft + grid de sitemap real (Sitemap, componente reutilizável fora do
// tema), mesma composição do PlatformFooter de referência (protótipo venore-docks,
// platform-frame.tsx). brand.color aqui é o único lugar do app (fora da impressão de PDF do
// plugin birthdays) que pinta algo com a cor de marca — um traço de acento sob a marca, cor de
// negócio injetada via prop, não um token semântico shadcn (mesma exceção documentada em
// build-birthday-pdf-html.ts). Server component puro, sem I/O — quem busca dado (getBrandConfig +
// getMenuByLocation("sitemap")) é platform/theme-rendering/resolve-theme-slot-props.ts.
export function FooterSlot({ brand, sitemapItems, creditsEnabled, loginLinkHref }: FooterSlotProps) {
  return (
    <footer className="mt-auto grid gap-8 border-t border-border px-4 py-12 text-muted-foreground sm:px-6 lg:grid-cols-[max-content_minmax(0,1fr)] lg:gap-12 lg:px-8">
      <div className="w-fit max-w-full justify-self-start space-y-5 rounded-panel border border-border bg-accent/14 px-6 py-6">
        <div>
          <div className="max-w-40 origin-left scale-125">
            <PlatformBrand
              name={brand.name}
              mode={brand.mode}
              size={brand.size}
              scrolledSize={brand.scrolledSize}
              position={brand.position}
              logoUrl={brand.logoUrl}
              scrolledLogoUrl={brand.scrolledLogoUrl}
              isScrolled={false}
            />
          </div>
          <span aria-hidden className="mt-4 block h-0.5 w-10 rounded-full bg-primary/40" />
        </div>
        {brand.description.trim().length > 0 && (
          <p className="max-w-[34ch] text-pretty text-xs leading-6 text-muted-foreground">{brand.description}</p>
        )}
      </div>

      <div className="space-y-4 pt-1">
        <Sitemap items={sitemapItems} />
        {loginLinkHref && (
          // Deliberado, separado do sitemap: só aparece quando o admin escondeu "Entrar" do
          // header (nav.hideLoginLink) e pediu explicitamente pra manter um acesso no rodapé
          // (nav.showLoginInFooter) — platform/nav-visibility/get-nav-visibility.ts.
          <Link
            href={loginLinkHref}
            className="inline-flex rounded-sm text-xs font-medium uppercase tracking-caps text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Entrar
          </Link>
        )}
      </div>

      {creditsEnabled ? (
        <div data-credits className="col-span-full border-t border-border pt-4 text-xs text-muted-foreground">
          Venore Docks
        </div>
      ) : null}
    </footer>
  );
}
