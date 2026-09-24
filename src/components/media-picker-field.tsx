"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { computeFileChecksum } from "@/lib/compute-file-checksum";
import {
  confirmUploadForPickerAction,
  listCategoriesForPickerAction,
  listMediaForPickerAction,
  requestUploadTicketForPickerAction,
  uploadMediaForPickerAction,
  type PickableCategory,
  type PickableMedia,
} from "./media-picker-field.actions";

// Acima disso, o upload sai do caminho server-buffered (server action com o arquivo inteiro em
// memória) e vai pro fluxo de ticket + upload direto ao Blob — necessário sobretudo pra vídeo de
// playlist do broadcast, que pode chegar a 200MB (bem acima do limite de body de uma server
// action). Abaixo do limite, o caminho buffered é mais simples e é o único que sanitiza SVG
// (sanitize-svg-buffer.ts só roda nesse caminho — ver assertTypeAllowedForDirectUpload).
const SERVER_BUFFERED_MAX_BYTES = 4 * 1024 * 1024;

type UploadStatus =
  | { step: "idle" }
  | { step: "uploading" }
  | { step: "error"; message: string };

export function MediaPickerField({
  name,
  label = "Mídia (opcional)",
  initialMedia = null,
  onSelect,
}: {
  name: string;
  label?: string;
  initialMedia?: PickableMedia | null;
  onSelect?: (media: PickableMedia | null) => void;
}) {
  const [selected, setSelected] = useState<PickableMedia | null>(initialMedia);
  const [items, setItems] = useState<PickableMedia[]>([]);
  const [categories, setCategories] = useState<PickableCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ step: "idle" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadItems(nextCategoryId: string) {
    startTransition(async () => {
      const media = await listMediaForPickerAction(nextCategoryId || undefined);
      setItems(media);
    });
  }

  function openPicker() {
    dialogRef.current?.showModal();
    loadItems(categoryId);
    if (categories.length === 0) {
      listCategoriesForPickerAction().then(setCategories);
    }
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    loadItems(nextCategoryId);
  }

  function selectMedia(media: PickableMedia) {
    setSelected(media);
    onSelect?.(media);
    dialogRef.current?.close();
  }

  async function handleUploadNow(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadStatus({ step: "uploading" });
    try {
      const contentType = file.type || "application/octet-stream";

      if (file.size <= SERVER_BUFFERED_MAX_BYTES) {
        const result = await uploadMediaForPickerAction({
          filename: file.name,
          contentType,
          size: file.size,
          data: await file.arrayBuffer(),
        });
        if (!result.success) {
          setUploadStatus({ step: "error", message: result.error.message });
          return;
        }
        setUploadStatus({ step: "idle" });
        selectMedia(result.data);
        return;
      }

      const ticket = await requestUploadTicketForPickerAction({ filename: file.name, contentType, size: file.size });
      if (!ticket.success) {
        setUploadStatus({ step: "error", message: ticket.error.message });
        return;
      }

      const checksum = await computeFileChecksum(file);
      const blob = await upload(ticket.data.pathname, file, {
        access: "public",
        handleUploadUrl: "/api/media/upload",
        contentType: ticket.data.contentType,
        clientPayload: JSON.stringify({ filename: file.name, contentType: ticket.data.contentType, size: file.size }),
      });

      const registered = await confirmUploadForPickerAction({
        filename: file.name,
        pathname: blob.pathname,
        url: blob.url,
        contentType: ticket.data.contentType,
        size: file.size,
        checksum,
      });
      if (!registered.success) {
        setUploadStatus({ step: "error", message: registered.error.message });
        return;
      }

      setUploadStatus({ step: "idle" });
      selectMedia(registered.data);
    } catch (error) {
      setUploadStatus({ step: "error", message: error instanceof Error ? error.message : "Falha inesperada no upload." });
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      <div className="mt-1 flex items-center gap-3">
        {selected && (
          <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
            {selected.contentType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.filename} className="h-8 w-8 rounded object-cover" />
            ) : null}
            <span className="max-w-[12rem] truncate text-xs text-muted-foreground">{selected.filename}</span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                onSelect?.(null);
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
          className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground outline-none ui-motion-base hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selected ? "Trocar" : "Selecionar mídia"}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="max-h-[85vh] w-[90vw] max-w-4xl overflow-y-auto rounded-panel border border-border bg-card ui-panel-padding-roomy text-foreground backdrop:bg-foreground/40"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Selecionar mídia</h2>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" onChange={handleUploadNow} className="hidden" disabled={uploadStatus.step === "uploading"} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus.step === "uploading"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground outline-none ui-motion-base hover:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-56"
            >
              {uploadStatus.step === "uploading" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              {uploadStatus.step === "uploading" ? "Enviando..." : "Enviar agora"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-sm text-sm text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Fechar
            </button>
          </div>
        </div>

        {uploadStatus.step === "error" && <p className="mt-2 text-xs text-destructive">{uploadStatus.message}</p>}

        {categories.length > 0 && (
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Categoria
            <select
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
                      <span className="text-[10px] text-muted-foreground/56">arquivo</span>
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
              <p className="text-xs text-muted-foreground">Use &quot;Enviar agora&quot; acima, ou gerencie a biblioteca completa em Mídia.</p>
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
