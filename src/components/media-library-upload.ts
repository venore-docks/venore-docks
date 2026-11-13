"use client";

import { uploadFileDirect } from "@/lib/upload-file-direct";
import { computeFileChecksum } from "@/lib/compute-file-checksum";
import { resolveUploadContentType } from "@/lib/resolve-upload-content-type";
import type { OperationResult } from "@/shared/types";
import {
  confirmUploadForPickerAction,
  requestUploadTicketForPickerAction,
  uploadMediaForPickerAction,
  type PickableMedia,
} from "./media-picker-field.actions";

// Acima disso, o upload sai do caminho server-buffered (server action com o arquivo inteiro em
// memória) e vai pro fluxo de ticket + upload direto ao Blob — necessário sobretudo pra vídeo de
// playlist do broadcast, que pode chegar a 200MB (bem acima do limite de body de uma server
// action). Abaixo do limite, o caminho buffered é mais simples e é o único que sanitiza SVG
// (sanitize-svg-buffer.ts só roda nesse caminho — ver assertTypeAllowedForDirectUpload).
export const SERVER_BUFFERED_MAX_BYTES = 4 * 1024 * 1024;

// Envio de UM arquivo do navegador pra biblioteca de mídia (MMS), escolhendo sozinho o caminho
// (buffered ou ticket + upload direto). É o mesmo fluxo do "Enviar agora" do MediaPickerField,
// exportado pelo SDK (@venore/plugin-sdk/ui) pra quem precisa enviar vários arquivos de uma vez
// (galeria de fotos) sem reimplementar ticket/checksum/upload direto. Uma chamada por arquivo:
// nunca junta arquivos num body só (o limite da server action vale por chamada).
export async function uploadFileToMediaLibrary(file: File): Promise<OperationResult<PickableMedia>> {
  try {
    const contentType = resolveUploadContentType(file.name, file.type);

    if (file.size <= SERVER_BUFFERED_MAX_BYTES) {
      return await uploadMediaForPickerAction({
        filename: file.name,
        contentType,
        size: file.size,
        data: await file.arrayBuffer(),
      });
    }

    const ticket = await requestUploadTicketForPickerAction({ filename: file.name, contentType, size: file.size });
    if (!ticket.success) {
      return ticket;
    }

    const checksum = await computeFileChecksum(file);
    const blob = await uploadFileDirect(ticket.data, file);

    return await confirmUploadForPickerAction({
      filename: file.name,
      pathname: blob.pathname,
      url: blob.url,
      contentType: ticket.data.contentType,
      size: file.size,
      checksum,
    });
  } catch (error) {
    return {
      success: false,
      error: {
        code: "media.upload_failed",
        message: error instanceof Error ? error.message : "Falha inesperada no upload.",
      },
    };
  }
}
