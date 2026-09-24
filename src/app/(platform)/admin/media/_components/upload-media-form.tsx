"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeFileChecksum } from "@/lib/compute-file-checksum";
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

type UploadStatus = { step: "idle" } | { step: "uploading" } | { step: "error"; message: string };

export function UploadMediaForm() {
  const router = useRouter();
  const [visibility, setVisibility] = useState<"private" | "restricted" | "public">("private");
  const [status, setStatus] = useState<UploadStatus>({ step: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setStatus({ step: "uploading" });
    try {
      const contentType = file.type || "application/octet-stream";

      if (file.size <= SERVER_BUFFERED_MAX_BYTES) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("visibility", visibility);
        const result: MediaActionState = await uploadMediaAction({ error: null }, formData);
        if (result.error) {
          setStatus({ step: "error", message: result.error });
          toast.error(result.error);
          return;
        }
      } else {
        const ticket = await requestMediaUploadTicketAction({ filename: file.name, contentType, size: file.size });
        if (!ticket.success) {
          setStatus({ step: "error", message: ticket.error.message });
          toast.error(ticket.error.message);
          return;
        }

        const checksum = await computeFileChecksum(file);
        const blob = await upload(ticket.data.pathname, file, {
          access: "public",
          handleUploadUrl: "/api/media/upload",
          contentType: ticket.data.contentType,
          clientPayload: JSON.stringify({ filename: file.name, contentType: ticket.data.contentType, size: file.size }),
        });

        const registered = await confirmMediaUploadAction({
          filename: file.name,
          pathname: blob.pathname,
          url: blob.url,
          contentType: ticket.data.contentType,
          size: file.size,
          checksum,
          visibility,
        });
        if (!registered.success) {
          setStatus({ step: "error", message: registered.error.message });
          toast.error(registered.error.message);
          return;
        }
      }

      setStatus({ step: "idle" });
      fileInputRef.current!.value = "";
      toast.success("Arquivo enviado.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada no upload.";
      setStatus({ step: "error", message });
      toast.error(message);
    }
  }

  const pending = status.step === "uploading";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        required
        disabled={pending}
        className="rounded-sm text-sm text-muted-foreground outline-none ui-motion-base file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-56"
      />
      <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)} disabled={pending}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">Privado</SelectItem>
          <SelectItem value="restricted">Restrito</SelectItem>
          <SelectItem value="public">Público</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar"}
      </Button>
      {status.step === "error" && <p className="text-xs text-destructive">{status.message}</p>}
    </form>
  );
}
