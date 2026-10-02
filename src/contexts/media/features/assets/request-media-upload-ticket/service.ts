import { MEDIA_ALLOWED_TYPES } from "@/contexts/media/contracts/types";
import { resolveMediaStorageFolder } from "@/contexts/media/resolve-media-storage-folder";
import { storagePort } from "@/infrastructure/storage";
import { beginOperation, endOperation } from "@/observability";
import type { OperationResult } from "@/shared/types";
import type { MediaDirectUpload, MediaUploadTicket, RequestMediaUploadTicketCommand } from "./types";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Tipos que exigem sanitização de bytes (hoje só SVG, ver sanitize-svg-buffer.ts) nunca podem
// passar pelo fluxo de upload direto ao Blob (ticket + confirm): nesse fluxo o servidor nunca vê
// os bytes antes do arquivo já estar público no storage (blob-spec seção 9), então não há onde
// sanitizar. Só entram pelo upload server-buffered (uploadMediaAsset e afins). Checado nos três
// pontos de entrada do fluxo direto: requestMediaUploadTicket (abaixo), onBeforeGenerateToken
// (route.ts) e registerUploadedMedia (handler.ts).
const TYPES_REQUIRING_BUFFERED_UPLOAD = new Set(["image/svg+xml"]);

export function assertTypeAllowedForDirectUpload(contentType: string): OperationResult<true> {
  if (TYPES_REQUIRING_BUFFERED_UPLOAD.has(contentType)) {
    return {
      success: false,
      error: {
        code: "media.upload.requires_buffered_upload",
        message: `O tipo "${contentType}" precisa ser enviado pelo formulário de upload direto, não pelo upload em duas etapas.`,
      },
    };
  }
  return { success: true, data: true };
}

// Reaproveitada tanto pelo passo inicial (requestMediaUploadTicket) quanto pela revalidação
// dentro de onBeforeGenerateToken no route handler (blob-spec seção 5 — o limite é checado duas
// vezes: no ticket e de novo quando o upload é confirmado).
export function validateMediaUploadCandidate(input: {
  contentType: string;
  size: number;
}): OperationResult<{ maxSizeBytes: number }> {
  const rule = MEDIA_ALLOWED_TYPES[input.contentType];
  if (!rule) {
    return {
      success: false,
      error: {
        code: "media.upload.unsupported_type",
        message: `O tipo de arquivo "${input.contentType}" não é permitido.`,
      },
    };
  }

  if (input.size <= 0) {
    return { success: false, error: { code: "media.upload.invalid_size", message: "O tamanho do arquivo deve ser maior que zero." } };
  }

  if (input.size > rule.maxSizeBytes) {
    return {
      success: false,
      error: {
        code: "media.upload.file_too_large",
        message: `O arquivo excede o limite de ${rule.maxSizeBytes} bytes para o tipo "${input.contentType}".`,
      },
    };
  }

  return { success: true, data: { maxSizeBytes: rule.maxSizeBytes } };
}

export async function requestMediaUploadTicket(
  command: RequestMediaUploadTicketCommand,
): Promise<OperationResult<MediaUploadTicket>> {
  const handle = beginOperation({
    useCase: "media.request-media-upload-ticket",
    actor: { id: command.actorId, type: "user" },
    kind: "read",
  });

  const validation = validateMediaUploadCandidate(command);
  if (!validation.success) {
    endOperation(handle, validation);
    return validation;
  }

  const directUploadCheck = assertTypeAllowedForDirectUpload(command.contentType);
  if (!directUploadCheck.success) {
    endOperation(handle, directUploadCheck);
    return directUploadCheck;
  }

  const pathname = `${resolveMediaStorageFolder(command.contentType)}/${crypto.randomUUID()}-${sanitizeFilename(command.filename)}`;

  let directUpload: MediaDirectUpload;
  switch (storagePort.directUploadKind()) {
    case "presigned-post": {
      const ticket = await storagePort.createUploadTicket({
        key: pathname,
        contentType: command.contentType,
        maxSizeBytes: validation.data.maxSizeBytes,
      });
      directUpload = { method: "presigned-post", url: ticket.uploadUrl, fields: ticket.fields ?? {} };
      break;
    }
    case "vercel-blob":
      directUpload = { method: "vercel-blob" };
      break;
    default: {
      const error = {
        code: "media.upload.direct_unsupported",
        message: "Este storage não aceita upload direto de arquivos grandes — envie um arquivo menor.",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  endOperation(handle, { success: true });
  return {
    success: true,
    data: { pathname, contentType: command.contentType, maxSizeBytes: validation.data.maxSizeBytes, directUpload },
  };
}
