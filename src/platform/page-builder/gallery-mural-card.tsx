import { cn } from "@/lib/utils";

// Peças visuais do mural da galeria, sem estado: usadas pelo renderer (server, mural sem lightbox) e
// pelo lightbox (client). Só tokens shadcn; propriedades lógicas (page-builder tem baseline {}).

export type GalleryMuralItem = {
  id: string;
  // Variante pequena (webp redimensionada) pro card; fullUrl é o original, pro lightbox.
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  caption: string;
};

// Cartão do mural: borda + sombra do tema, leve elevação no hover (só sem prefers-reduced-motion).
export const MURAL_CARD_CLASSES = cn(
  "group relative block w-full overflow-hidden rounded-panel border border-border bg-muted shadow-panel",
  "transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-float",
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

// Cartão da grade simples com lightbox: sem sombra nem elevação, só o recorte e o foco.
export const PLAIN_CARD_CLASSES = cn(
  "group relative block w-full overflow-hidden rounded-panel bg-muted",
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

export function MuralCardContent({ item, aspectClass }: { item: GalleryMuralItem; aspectClass: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do bloco de imagem: sem domínio remoto configurado pra next/image */}
      <img
        src={item.thumbUrl}
        alt={item.alt}
        loading="lazy"
        decoding="async"
        className={cn(
          "block w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]",
          // Com proporção fixa, o aspect-ratio mora no cartão e a imagem o preenche.
          aspectClass ? "h-full" : "h-auto",
        )}
      />
      {item.caption && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-3 pt-8 pb-2 text-xs font-medium text-foreground">
          {item.caption}
        </span>
      )}
    </>
  );
}
