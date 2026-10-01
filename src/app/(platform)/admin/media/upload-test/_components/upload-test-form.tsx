"use client";

import { uploadFileDirect } from "@/lib/upload-file-direct";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { computeFileChecksum } from "@/lib/compute-file-checksum";
import { confirmUploadAction, requestUploadTicketAction } from "../actions";

type Status =
  | { step: "idle" }
  | { step: "requesting-ticket" }
  | { step: "uploading" }
  | { step: "confirming" }
  | { step: "done"; assetId: string; url: string }
  | { step: "error"; message: string };

// Página de teste mínima do pipeline de upload (docs/media/blob-spec.md) — não é a UI da
// biblioteca de mídia (sem listagem, sem picker); só exercita o caminho ponta a ponta:
// pedir ticket -> upload direto ao Blob -> confirmar registro.
export function UploadTestForm() {
  const [status, setStatus] = useState<Status>({ step: "idle" });

  async function handleSubmit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setStatus({ step: "error", message: "Selecione um arquivo para enviar." });
      return;
    }

    try {
      setStatus({ step: "requesting-ticket" });
      const ticket = await requestUploadTicketAction({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!ticket.success) {
        setStatus({ step: "error", message: ticket.error.message });
        return;
      }

      const checksum = await computeFileChecksum(file);

      setStatus({ step: "uploading" });
      const blob = await uploadFileDirect(ticket.data, file);

      setStatus({ step: "confirming" });
      const registered = await confirmUploadAction({
        filename: file.name,
        pathname: blob.pathname,
        url: blob.url,
        contentType: ticket.data.contentType,
        size: file.size,
        checksum,
      });
      if (!registered.success) {
        setStatus({ step: "error", message: registered.error.message });
        return;
      }

      setStatus({ step: "done", assetId: registered.data.id, url: registered.data.url });
    } catch (error) {
      setStatus({ step: "error", message: error instanceof Error ? error.message : "Falha inesperada no upload." });
    }
  }

  const pending = status.step !== "idle" && status.step !== "done" && status.step !== "error";

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          required
          disabled={pending}
          className="rounded-sm text-sm text-muted-foreground outline-none ui-motion-base file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar"}
        </Button>
      </form>

      {status.step === "requesting-ticket" && <p className="text-sm text-muted-foreground">Pedindo autorização de upload...</p>}
      {status.step === "uploading" && <p className="text-sm text-muted-foreground">Enviando direto ao Blob Store...</p>}
      {status.step === "confirming" && <p className="text-sm text-muted-foreground">Confirmando registro do asset...</p>}
      {status.step === "error" && <p className="text-sm text-destructive">{status.message}</p>}
      {status.step === "done" && (
        <p className="text-sm text-primary">
          Asset registrado: {status.assetId} —{" "}
          <a href={status.url} target="_blank" rel="noreferrer" className="underline">
            ver arquivo
          </a>
        </p>
      )}
    </div>
  );
}
