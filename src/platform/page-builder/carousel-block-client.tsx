"use client";

import { useRef, type ReactNode } from "react";
import type { UseEmblaCarouselType } from "embla-carousel-react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, CarouselDots } from "@/components/ui/carousel";

// Única fronteira client de block-renderers.tsx (que é "server-only" — import "server-only" no
// topo do arquivo): autoplay/drag/dots exigem estado e efeitos de verdade, algo que nenhum outro
// bloco do page-builder precisa hoje. O conteúdo de cada slide (um ReactNode por bloco de imagem,
// já resolvido por renderBlocks no server) chega pronto via `slides` — este componente só monta a
// casca interativa ao redor, nunca busca dado sozinho.
export function CarouselBlockClient({
  slides,
  autoplay,
  interval,
  loop,
  showDots,
  htmlId,
}: {
  slides: ReactNode[];
  autoplay: boolean;
  interval: number;
  loop: boolean;
  showDots: boolean;
  htmlId: string | null;
}) {
  const apiRef = useRef<NonNullable<UseEmblaCarouselType[1]>>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  function setApi(api: UseEmblaCarouselType[1]) {
    apiRef.current = api;
    if (timerRef.current) clearInterval(timerRef.current);
    if (!api || !autoplay) return;
    timerRef.current = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else if (loop) {
        api.scrollTo(0);
      }
    }, Math.max(1, interval) * 1000);
  }

  return (
    <div id={htmlId ?? undefined} className="space-y-3">
      <Carousel opts={{ loop }} setApi={setApi} className="w-full">
        <CarouselContent>
          {/* index como key: slides já são ReactNode opaco resolvido no server (sem id próprio
              aqui), mas a ordem é estável dentro de uma composição salva. */}
          {slides.map((slide, index) => (
            <CarouselItem key={index}>{slide}</CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      {showDots && <CarouselDots />}
    </div>
  );
}
