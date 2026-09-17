import type { HeaderBrand } from "@/contexts/themes/contracts/types";
import { isRecolorableBrandAsset } from "@/theme-sdk/brand-asset";

// Capacidade portada de PlatformBrand do protótipo (venore-docks) — modo texto/svg/png, variante
// scrolled, posição. Dimensionamento reescrito: em vez dos 4 números mágicos px do protótipo
// (base mobile/desktop hardcoded duas vezes) e da tabela de limiares de escala no scroll
// (0.72–0.84), a altura vem do token --ui-control-height-lg multiplicado pela porcentagem de
// `size`/`scrolledSize` (ambos já configuráveis via settings, não mais um "talvez" opcional), e
// a largura é derivada por aspect-ratio — não há dois números independentes pra manter em sync.
const BRAND_ASPECT_RATIO = "100 / 68";

// `isScrolled` continua um boolean prop de verdade (não lê nenhum estado de scroll sozinho) porque
// este componente também é renderizado fora de qualquer header reativo, no preview estático de
// admin/settings/brand/_components/brand-settings-form.tsx (dois painéis lado a lado, um
// forçado em cada estado, sem scroll real). Dentro do HeaderSlot de verdade, porém, o valor do
// prop é só o baseline SSR (sempre `false`) — a reatividade de verdade vem das classes
// `group-data-[scrolled=.../header:` abaixo, que têm especificidade maior (classe + seletor de
// atributo) que as classes derivadas do prop e por isso sempre vencem quando existe um ancestral
// `group/header` com `data-scrolled` (docs/ui/shell-spec.md §2.5). Sem esse ancestral (o caso do
// preview), as classes group-data simplesmente não casam com nada e o prop volta a mandar.
export function PlatformBrand({
  name,
  mode,
  size,
  scrolledSize,
  position,
  isScrolled,
  logoUrl,
  scrolledLogoUrl,
}: HeaderBrand & { isScrolled: boolean }) {
  const originClass = position === "center" ? "origin-center" : "origin-left";
  // `transform`, não a propriedade `scale` dedicada do Tailwind v4: ui-motion-emphasis já lista
  // `transform` em transition-property (theme.css/globals.css), então a troca anima de graça sem
  // precisar duplicar o vocabulário de motion só pra essa propriedade.
  const baseTransform = isScrolled ? "transform-[scale(var(--brand-scale-scrolled))]" : "transform-[scale(var(--brand-scale-top))]";

  if (mode === "text") {
    return <span className="font-medium">{name}</span>;
  }

  return (
    <span
      className={
        "block h-[calc(var(--ui-control-height-lg)*0.92*(var(--brand-size-pct)/100))] " +
        "md:h-[calc(var(--ui-control-height-lg)*1.32*(var(--brand-size-pct)/100))] " +
        originClass +
        ` ${baseTransform} group-data-[scrolled=true]/header:transform-[scale(var(--brand-scale-scrolled))] group-data-[scrolled=false]/header:transform-[scale(var(--brand-scale-top))] ` +
        "ui-motion-emphasis"
      }
      style={{
        aspectRatio: BRAND_ASPECT_RATIO,
        ["--brand-size-pct" as string]: size,
        ["--brand-scale-top" as string]: 1,
        ["--brand-scale-scrolled" as string]: scrolledSize / size,
      }}
    >
      {mode === "svg" && isRecolorableBrandAsset(logoUrl) ? (
        <span
          aria-label={name}
          role="img"
          className="block h-full w-full bg-current ui-motion-base"
          style={{
            maskImage: `url('${logoUrl}')`,
            WebkitMaskImage: `url('${logoUrl}')`,
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            maskSize: "contain",
            WebkitMaskSize: "contain",
          }}
        />
      ) : (
        // Duas variantes empilhadas ocupando o mesmo espaço (mesma célula via `absolute inset-0`
        // sobre o wrapper `relative`), crossfade só de opacity — nunca troca de `src`, que faria a
        // imagem pipocar em vez de suavizar (docs/ui/shell-spec.md §2.5, "crossfade sem reflow").
        <span className="relative block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={name}
            className={
              "absolute inset-0 h-full w-full object-contain ui-motion-base " +
              (isScrolled ? "opacity-0" : "opacity-100") +
              " group-data-[scrolled=true]/header:opacity-0 group-data-[scrolled=false]/header:opacity-100"
            }
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scrolledLogoUrl}
            alt=""
            aria-hidden
            className={
              "absolute inset-0 h-full w-full object-contain ui-motion-base " +
              (isScrolled ? "opacity-100" : "opacity-0") +
              " group-data-[scrolled=true]/header:opacity-100 group-data-[scrolled=false]/header:opacity-0"
            }
          />
        </span>
      )}
    </span>
  );
}
