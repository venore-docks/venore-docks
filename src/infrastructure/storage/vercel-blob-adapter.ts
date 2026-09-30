import { del, get, head, list, put } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type {
  ByteRange,
  RemoteObjectSummary,
  StoredObjectBody,
  StoredObjectInfo,
  StoragePort,
  StoragePutInput,
  StoredObject,
  UploadTicket,
  UploadTicketInput,
} from "./storage-port";

const UPLOAD_TICKET_TTL_SECONDS = 60 * 30;

// MEDIA_BLOB_ACCESS="private" pra um Blob Store privado: nenhum arquivo fica acessível pela URL do
// storage, tudo passa pela rota autorizada do app. Default "public" (compatível com stores já
// existentes) — aí só os assets NÃO públicos passam pela rota; a URL crua de um arquivo privado
// antigo continua existindo (caminho com UUID, não adivinhável), ver docs/media/blob-spec.md.
function blobAccess(): "public" | "private" {
  return process.env.MEDIA_BLOB_ACCESS === "private" ? "private" : "public";
}

// Nenhum tipo de @vercel/blob escapa deste arquivo — o resto do domínio só conhece StoragePort
// (blob-spec seção 2).
export class VercelBlobAdapter implements StoragePort {
  async store(input: StoragePutInput): Promise<StoredObject> {
    const blob = await put(input.key, input.data, {
      access: blobAccess(),
      contentType: input.contentType,
      addRandomSuffix: false,
      allowOverwrite: input.allowOverwrite ?? false,
    });
    return { key: blob.pathname, url: blob.url, size: input.data.byteLength };
  }

  async remove(key: string): Promise<void> {
    await del(key);
  }

  resolveUrl(key: string): string {
    const storeId = process.env.BLOB_READ_WRITE_TOKEN?.split("_").at(-2);
    return storeId ? `https://${storeId}.public.blob.vercel-storage.com/${key}` : key;
  }

  async createUploadTicket(input: UploadTicketInput): Promise<UploadTicket> {
    const token = await generateClientTokenFromReadWriteToken({
      pathname: input.key,
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.maxSizeBytes,
      addRandomSuffix: false,
    });
    return {
      key: input.key,
      uploadUrl: "https://blob.vercel-storage.com",
      token,
      expiresAt: new Date(Date.now() + UPLOAD_TICKET_TTL_SECONDS * 1000),
    };
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await head(key);
      return { size: info.size, contentType: info.contentType };
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange | null): Promise<StoredObjectBody | null> {
    const result = await get(key, {
      access: blobAccess(),
      headers: range ? { Range: `bytes=${range.start}-${range.end}` } : undefined,
    });
    if (!result || result.statusCode !== 200) return null;
    const partial = result.headers.get("content-range");
    const total = partial ? Number(partial.split("/").at(-1)) : result.blob.size;
    return {
      body: result.stream,
      size: Number.isFinite(total) ? total : result.blob.size,
      contentType: result.blob.contentType,
      range: partial && range ? range : null,
    };
  }

  servesPublicly(): boolean {
    return blobAccess() === "public";
  }

  async listObjects(prefix?: string): Promise<RemoteObjectSummary[]> {
    const { blobs } = await list({ prefix });
    return blobs.map((blob) => ({ key: blob.pathname, size: blob.size, uploadedAt: blob.uploadedAt }));
  }
}
