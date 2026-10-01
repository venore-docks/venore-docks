import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type {
  ByteRange,
  DirectUploadKind,
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

// Configuração por env var (uma instância = um bucket):
// - S3_BUCKET (obrigatória) e S3_REGION (default "us-east-1").
// - Credencial: S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY, ou — sem as duas — a cadeia padrão da AWS
//   (role da instância/ECS/Lambda, AWS_PROFILE, AWS_ACCESS_KEY_ID...). Na AWS, prefira o role.
// - S3_ENDPOINT + S3_FORCE_PATH_STYLE=true pra serviço compatível com S3 (MinIO, Cloudflare R2).
// - MEDIA_S3_ACCESS="public" quando o bucket (ou o CDN na frente dele) serve os objetos
//   publicamente; default "private": nenhum objeto é lido pela URL do bucket, tudo passa pela rota
//   autorizada do app (/api/media/asset/[id]) — mesmo modelo do MEDIA_BLOB_ACCESS.
// - S3_PUBLIC_URL: base pública dos objetos (CloudFront/CDN). Sem ela, a URL virtual-hosted do S3.
export type S3StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
  access: "public" | "private";
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

export function readS3StorageConfig(env: Record<string, string | undefined> = process.env): S3StorageConfig {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error('MEDIA_STORAGE_DRIVER="s3" exige S3_BUCKET (e S3_REGION, se não for us-east-1).');
  }
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Defina S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY juntas (ou nenhuma, pra usar o role da AWS).");
  }
  return {
    bucket,
    region: env.S3_REGION?.trim() || "us-east-1",
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: env.S3_PUBLIC_URL?.trim().replace(/\/+$/, "") || undefined,
    access: env.MEDIA_S3_ACCESS === "public" ? "public" : "private",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function isNotFound(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return error.$metadata.httpStatusCode === 404 || error.name === "NotFound" || error.name === "NoSuchKey";
  }
  return false;
}

// Nenhum tipo do SDK da AWS escapa deste arquivo — o resto do domínio só conhece StoragePort.
export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;

  constructor(
    private readonly config: S3StorageConfig = readS3StorageConfig(),
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: config.credentials,
      });
  }

  async store(input: StoragePutInput): Promise<StoredObject> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.key,
          Body: input.data,
          ContentType: input.contentType,
          // Escrita condicional (S3 desde 2024): sem allowOverwrite, uma key existente vira erro —
          // mesmo contrato do Vercel Blob (addRandomSuffix: false, allowOverwrite: false).
          IfNoneMatch: input.allowOverwrite ? undefined : "*",
        }),
      );
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412) {
        throw new Error(`Já existe um objeto com a key "${input.key}" no storage.`);
      }
      throw error;
    }
    return { key: input.key, url: this.resolveUrl(input.key), size: input.data.byteLength };
  }

  async remove(key: string): Promise<void> {
    // DeleteObject já é idempotente no S3 (key inexistente responde 204).
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  resolveUrl(key: string): string {
    const encoded = encodeKey(key);
    if (this.config.publicBaseUrl) return `${this.config.publicBaseUrl}/${encoded}`;
    if (this.config.endpoint) {
      const base = this.config.endpoint.replace(/\/+$/, "");
      return this.config.forcePathStyle ? `${base}/${this.config.bucket}/${encoded}` : `${base}/${encoded}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${encoded}`;
  }

  directUploadKind(): DirectUploadKind {
    return "presigned-post";
  }

  // Presigned POST (e não PUT) porque só o POST impõe o tamanho máximo no próprio S3
  // (content-length-range) — o PUT assinado aceitaria um arquivo maior que o ticket. O tipo também
  // fica travado. registerUploadedMedia confere de novo pelo stat() depois do upload.
  async createUploadTicket(input: UploadTicketInput): Promise<UploadTicket> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.config.bucket,
      Key: input.key,
      Conditions: [
        ["content-length-range", 1, input.maxSizeBytes],
        ["eq", "$Content-Type", input.contentType],
      ],
      Fields: { "Content-Type": input.contentType },
      Expires: UPLOAD_TICKET_TTL_SECONDS,
    });
    return {
      key: input.key,
      uploadUrl: url,
      token: "",
      fields,
      expiresAt: new Date(Date.now() + UPLOAD_TICKET_TTL_SECONDS * 1000),
    };
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? "application/octet-stream" };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async read(key: string, range?: ByteRange | null): Promise<StoredObjectBody | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        }),
      );
      if (!object.Body) return null;
      const contentRange = object.ContentRange;
      const total = contentRange ? Number(contentRange.split("/").at(-1)) : (object.ContentLength ?? 0);
      return {
        body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        size: Number.isFinite(total) ? total : (object.ContentLength ?? 0),
        contentType: object.ContentType ?? "application/octet-stream",
        range: contentRange && range ? range : null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  servesPublicly(): boolean {
    return this.config.access === "public";
  }

  async listObjects(prefix?: string): Promise<RemoteObjectSummary[]> {
    const out: RemoteObjectSummary[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        out.push({ key: item.Key, size: item.Size ?? 0, uploadedAt: item.LastModified ?? new Date(0) });
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return out;
  }
}
