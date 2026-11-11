"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MuralCardContent, type GalleryMuralItem } from "./gallery-mural-card";
import { wrapIndex } from "./gallery-layout";

// Casca interativa da galeria em modo lightbox (mesma fronteira do carousel-block-client.tsx): o
// renderer server já resolveu as URLs; aqui só há estado de "qual imagem está aberta". Os cartões
// são <button> reais (SSR visível sem JS; Enter/Espaço abrem). O foco volta ao cartão ao fechar.
const SWIPE_THRESHOLD_PX = 48;

export function GalleryLightboxClient({
  items,
  gridClassName,
  cardClassName,
  aspectClass,
  htmlId,
  dataAttributes,
}: {
  items: GalleryMuralItem[];
  gridClassName: string;
  cardClassName: string;
  aspectClass: string;
  htmlId: string | null;
  dataAttributes?: Record<string, string>;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const total = items.length;
  const current = openIndex === null ? null : items[openIndex];

  // Pré-carrega a vizinhança pra a troca ser instantânea.
  useEffect(() => {
    if (openIndex === null) return;
    for (const delta of [-1, 1]) {
      const neighbor = items[wrapIndex(openIndex, delta, total)];
      if (neighbor) new window.Image().src = neighbor.fullUrl;
    }
  }, [openIndex, items, total]);

  function step(delta: number) {
    setOpenIndex((index) => (index === null ? index : wrapIndex(index, delta, total)));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = event.changedTouches[0].clientX - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) step(delta < 0 ? 1 : -1);
  }

  return (
    <>
      <div id={htmlId ?? undefined} {...dataAttributes} className={gridClassName}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.alt || `Ampliar imagem ${index + 1}`}
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setOpenIndex(index);
            }}
            className={cn(cardClassName, "cursor-zoom-in", aspectClass)}
          >
            <MuralCardContent item={item} aspectClass={aspectClass} />
          </button>
        ))}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent
          className="gap-3 p-2 sm:max-w-4xl sm:p-3"
          onKeyDown={handleKeyDown}
          // O Radix devolve o foco ao Trigger, que aqui não existe: devolvemos ao cartão que abriu.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          {current && (
            <>
              <div
                className="relative flex items-center justify-center overflow-hidden rounded-panel bg-muted"
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0].clientX;
                }}
                onTouchEnd={handleTouchEnd}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do bloco de imagem */}
                <img src={current.fullUrl} alt={current.alt} className="max-h-[75vh] w-full object-contain" />
                {total > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Imagem anterior"
                      onClick={() => step(-1)}
                      className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full shadow-float"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Próxima imagem"
                      onClick={() => step(1)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full shadow-float"
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 px-1 pb-1">
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-medium">{current.alt || "Imagem ampliada"}</DialogTitle>
                  <DialogDescription className={current.caption ? "text-xs" : "sr-only"}>
                    {current.caption || "Use as setas do teclado para navegar entre as imagens."}
                  </DialogDescription>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {(openIndex ?? 0) + 1} / {total}
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
