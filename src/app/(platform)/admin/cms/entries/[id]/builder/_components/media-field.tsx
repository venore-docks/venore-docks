"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { listMediaForPickerAction, type PickableMedia } from "@/components/media-picker-field.actions";

// Generalização de ImageField (era só imagem) — prop `accept` filtra por prefixo de mimeType
// ("image/", "audio/") antes de montar a grade do picker. listMediaForPickerAction não filtra por
// tipo na origem (devolve toda mídia), então o filtro é sempre client-side aqui.
export function MediaField({
  label,
  value,
  onChange,
  accept = "image/",
}: {
  label: string;
  value: string | null;
  onChange: (mediaId: string | null) => void;
  accept?: string;
}) {
  const [selected, setSelected] = useState<PickableMedia | null>(null);
  const [items, setItems] = useState<PickableMedia[]>([]);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaKindLabel = accept === "audio/" ? "arquivos de áudio" : "imagens";

  useEffect(() => {
    if (selected?.id === value) return;
    startTransition(async () => {
      if (!value) {
        setSelected(null);
        return;
      }
      const media = await listMediaForPickerAction();
      setSelected(media.find((item) => item.id === value) ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir a mudanças externas de `value`
  }, [value]);

  function openPicker() {
    dialogRef.current?.showModal();
    startTransition(async () => {
      const media = await listMediaForPickerAction();
      setItems(media.filter((item) => item.contentType.startsWith(accept)));
    });
  }

  function selectMedia(media: PickableMedia) {
    setSelected(media);
    onChange(media.id);
    dialogRef.current?.close();
  }

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>

      <div className="mt-1 flex items-center gap-3">
        {selected && (
          <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
            {selected.contentType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão de media-picker-field.tsx
              <img src={selected.url} alt={selected.filename} className="h-8 w-8 rounded object-cover" />
            ) : null}
            <span className="max-w-40 truncate text-xs text-muted-foreground">{selected.filename}</span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                onChange(null);
              }}
              className="rounded-sm text-xs font-medium text-destructive outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remover
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={openPicker}
          disabled={isPending}
          className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground outline-none ui-motion-base hover:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {selected ? "Trocar" : "Selecionar mídia"}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="max-h-[85vh] w-[90vw] max-w-4xl overflow-y-auto rounded-panel border border-border bg-card ui-panel-padding-roomy text-foreground backdrop:bg-foreground/40"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Selecionar mídia</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-sm text-sm text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Fechar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {isPending
            ? Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} className="aspect-square rounded-lg" />)
            : items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => selectMedia(item)}
                  className="flex flex-col gap-1 rounded-lg border border-border p-2 text-left outline-none ui-motion-base hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-16 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {item.contentType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground/56">{item.contentType || "arquivo"}</span>
                    )}
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground" title={item.filename}>
                    {item.filename}
                  </span>
                </button>
              ))}
          {!isPending && items.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-6 text-center">
              <ImageOff className="size-6 text-muted-foreground/56" strokeWidth={1.5} />
              <p className="text-sm text-foreground">Nenhum arquivo enviado ainda</p>
              <p className="text-xs text-muted-foreground">
                Envie {mediaKindLabel} na página de Mídia para poder selecioná-las aqui.
              </p>
              <Link
                href="/admin/media"
                className="rounded-sm text-xs font-medium text-foreground outline-none ui-motion-base hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ir para Mídia
              </Link>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
