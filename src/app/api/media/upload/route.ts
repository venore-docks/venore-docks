import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  assertTypeAllowedForDirectUpload,
  registerUploadedMediaForTrustedActor,
  validateMediaUploadCandidate,
} from "@/contexts/media";
import { authorizeActor } from "@/contexts/rbac";
import { checkRateLimit, getClientIp } from "@/infrastructure/rate-limit";
import { storagePort } from "@/infrastructure/storage";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";
import { beginOperation, endOperation } from "@/observability";

const RATE_LIMIT_CONFIG = { limit: 20, windowMs: 60_000 };

// Mensagem única pra toda negativa de autorização (não autenticado ou sem permissão) — não
// revela qual dos dois casos aconteceu, nem detalhes de RBAC (docs/media/blob-spec.md,
// seção 6/9: "a negativa não vaza informação sobre o que existe").
const UPLOAD_NOT_AUTHORIZED_MESSAGE = "Não foi possível autorizar este upload.";

type ClientUploadPayload = { filename: string; contentType: string; size: number };

function parseClientPayload(raw: string | null): ClientUploadPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClientUploadPayload>;
    if (typeof parsed.filename !== "string" || typeof parsed.contentType !== "string" || typeof parsed.size !== "number") {
      return null;
    }
    return { filename: parsed.filename, contentType: parsed.contentType, size: parsed.size };
  } catch {
    return null;
  }
}

// Log de falha com código e contexto (blob-spec/escopo item 6) — cada rejeição em
// onBeforeGenerateToken ou no handler passa por aqui antes de virar um throw, então toda
// negativa fica registrada mesmo que a resposta ao client seja genérica.
function logUploadRouteFailure(actorId: string, code: string, message: string): void {
  const handle = beginOperation({ useCase: "media.upload-route", actor: { id: actorId, type: "user" }, kind: "write" });
  endOperation(handle, { success: false, error: { code, message } });
}

// Marca um erro como já registrado em logUploadRouteFailure, pra não duplicar a entrada de
// observabilidade quando o catch externo trata o mesmo throw.
class LoggedUploadError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimitKey = `media.upload:${getClientIp(request.headers)}`;
  const rateLimit = await checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Muitas requisições de upload. Tente novamente em instantes." }, { status: 429 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const payload = parseClientPayload(clientPayloadRaw);
        if (!payload) {
          logUploadRouteFailure("anonymous", "media.upload.invalid_payload", `clientPayload inválido para pathname "${pathname}".`);
          throw new LoggedUploadError("media.upload.invalid_payload", 400);
        }

        const authz = await authorizeActor("media.manage");
        if (!authz.authorized) {
          logUploadRouteFailure("anonymous", authz.error.code, authz.error.message);
          throw new LoggedUploadError(UPLOAD_NOT_AUTHORIZED_MESSAGE, 403);
        }

        const validation = validateMediaUploadCandidate(payload);
        if (!validation.success) {
          logUploadRouteFailure(authz.actorId, validation.error.code, validation.error.message);
          throw new LoggedUploadError(validation.error.message, 400);
        }

        const directUploadCheck = assertTypeAllowedForDirectUpload(payload.contentType);
        if (!directUploadCheck.success) {
          logUploadRouteFailure(authz.actorId, directUploadCheck.error.code, directUploadCheck.error.message);
          throw new LoggedUploadError(directUploadCheck.error.message, 400);
        }

        return {
          allowedContentTypes: [payload.contentType],
          maximumSizeInBytes: validation.data.maxSizeBytes,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ actorId: authz.actorId, pathname, filename: payload.filename }),
        };
      },
      // Só dispara em produção/preview (URL publicamente alcançável) — em localhost, a
      // confirmação feita pelo browser (server action `confirmMediaUpload`, chamada assim que
      // upload() resolve no client) é o único caminho que registra o asset. Este callback é uma
      // segunda chamada de segurança, idempotente por pathname (blob-spec seção 9).
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const { actorId, filename } = JSON.parse(tokenPayload) as { actorId?: string; filename?: string };
        if (!actorId || !filename) return;

        // Lê pelo storagePort (funciona com Blob Store público ou privado) em vez de fetch da URL.
        const object = await storagePort.read(blob.pathname);
        if (!object) return;
        const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
        const checksum = computeSha256Hex(bytes);

        await registerUploadedMediaForTrustedActor({
          filename,
          pathname: blob.pathname,
          url: blob.url,
          contentType: blob.contentType,
          size: bytes.byteLength,
          checksum,
          actorId,
          // Checksum calculado aqui, a partir dos bytes baixados do próprio storage.
          checksumVerified: true,
        });
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LoggedUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    const message = error instanceof Error ? error.message : "Falha inesperada ao processar o upload.";
    logUploadRouteFailure("anonymous", "media.upload.route_error", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
