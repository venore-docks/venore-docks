"use client";

import { uploadFileDirect } from "@/lib/upload-file-direct";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeFileChecksum } from "@/lib/compute-file-checksum";
import { resolveUploadContentType } from "@/lib/resolve-upload-content-type";
import { formatSize } from "../_lib/media-library";
import {
  confirmMediaUploadAction,
  requestMediaUploadTicketAction,
  uploadMediaAction,
  type MediaActionState,
} from "../actions";

// Mesmo teto de components/media-picker-field.tsx: acima disso o upload sai do caminho
// server-buffered (server action com o arquivo inteiro em memória) e vai pro fluxo de ticket +
// upload direto ao Blob — necessário porque o limite de body de uma serverless function da Vercel
// (4.5MB) é bem menor que o teto de negócio em MEDIA_ALLOWED_TYPES (vídeo até 200MB), e é
// hardcoded pela plataforma — next.config.ts não consegue subi-lo. Sem essa ramificação, qualquer
// arquivo nessa faixa falhava batendo na Vercel antes de rodar qualquer código da aplicação (sem
// toast, sem erro — só "nada acontece").
const SERVER_BUFFERED_MAX_BYTES = 4 * 1024 * 1024;

const NO_CATEGORY = "none";

type QueueItem = {
  key: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
};

// Envia um arquivo (caminho buffered ou direto ao Blob, conforme o tamanho). Devolve a mensagem de
// erro, ou null em caso de sucesso.
async function sendFile(file: File, visibility: "private" | "public", categoryId: string | null): Promise<string | null> {
  const contentType = resolveUploadContentType(file.name, file.type);

  if (file.size <= SERVER_BUFFERED_MAX_BYTES) {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("visibility", visibility);
    if (categoryId) formData.set("categoryId", categoryId);
    const result: MediaActionState = await uploadMediaAction({ error: null }, formData);
    return result.error;
  }

  const ticket = await requestMediaUploadTicketAction({ filename: file.name, contentType, size: file.size });
  if (!ticket.success) return ticket.error.message;

  const checksum = await computeFileChecksum(file);
  const blob = await uploadFileDirect(ticket.data, file);

  const registered = await confirmMediaUploadAction({
    filename: file.name,
    pathname: blob.pathname,
    url: blob.url,
    contentType: ticket.data.contentType,
    size: file.size,
    checksum,
    visibility,
    categoryId,
  });
  return registered.success ? null : registered.error.message;
}

export function UploadMediaDialog({
  categories,
  defaultCategoryId,
}: {
  categories: { id: string; name: string }[];
  // Categoria ativa na biblioteca: o envio já cai nela (some a etapa de mover depois).
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? NO_CATEGORY);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);

  const pendingCount = queue.filter((item) => item.status === "pending" || item.status === "error").length;

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      status: "pending" as const,
    }));
    setQueue((current) => [...current, ...incoming]);
  }

  function updateItem(key: string, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleSend() {
    const targets = queue.filter((item) => item.status === "pending" || item.status === "error");
    if (targets.length === 0) return;

    setSending(true);
    let succeeded = 0;
    for (const item of targets) {
      updateItem(item.key, { status: "uploading", message: undefined });
      try {
        const error = await sendFile(item.file, visibility, categoryId === NO_CATEGORY ? null : categoryId);
        if (error) {
          updateItem(item.key, { status: "error", message: error });
        } else {
          updateItem(item.key, { status: "done" });
          succeeded += 1;
        }
      } catch (error) {
        updateItem(item.key, { status: "error", message: error instanceof Error ? error.message : "Falha inesperada no upload." });
      }
    }
    setSending(false);

    if (succeeded > 0) {
      toast.success(succeeded === 1 ? "Arquivo enviado." : `${succeeded} arquivos enviados.`);
      router.refresh();
    }
    // Tudo certo: fecha e limpa; se algo falhou, a lista fica pra tentar de novo.
    setQueue((current) => {
      if (current.every((item) => item.status === "done")) {
        setOpen(false);
        return [];
      }
      return current.filter((item) => item.status !== "done");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sending) return;
        setOpen(next);
        if (next) setCategoryId(defaultCategoryId ?? NO_CATEGORY);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <Upload className="size-4" strokeWidth={2} />
          Enviar arquivos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar arquivos</DialogTitle>
          <DialogDescription>Escolha a categoria e a visibilidade antes de enviar — vale para todos os arquivos da lista.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-panel border-2 border-dashed px-4 py-8 text-center ui-motion-base focus-within:ring-2 focus-within:ring-ring",
              dragging ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/40",
            )}
          >
            <Upload className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">Arraste arquivos aqui ou clique para escolher</span>
            <span className="text-xs text-muted-foreground">Imagens, vídeos, áudios e documentos. Dá para enviar vários de uma vez.</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              disabled={sending}
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>

          {queue.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
              {queue.map((item) => (
                <li key={item.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  {item.status === "uploading" && <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />}
                  {item.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                  {item.status === "error" && <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />}
                  {item.status === "pending" && <span className="size-4 shrink-0" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground" title={item.file.name}>
                      {item.file.name}
                    </p>
                    {item.message && <p className="text-xs text-destructive">{item.message}</p>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatSize(item.file.size)}</span>
                  {!sending && item.status !== "uploading" && (
                    <button
                      type="button"
                      aria-label={`Remover ${item.file.name} da lista`}
                      onClick={() => setQueue((current) => current.filter((entry) => entry.key !== item.key))}
                      className="rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Categoria</p>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={sending}>
                <SelectTrigger className="w-full" aria-label="Categoria dos arquivos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Visibilidade</p>
              <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)} disabled={sending}>
                <SelectTrigger className="w-full" aria-label="Visibilidade dos arquivos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Privado — só quem gerencia mídia</SelectItem>
                  <SelectItem value="public">Público — qualquer visitante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={sending || pendingCount === 0} onClick={handleSend}>
            {sending ? "Enviando…" : pendingCount > 1 ? `Enviar ${pendingCount} arquivos` : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
