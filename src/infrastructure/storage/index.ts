import { FilesystemStorageAdapter } from "./filesystem-storage-adapter";
import { InMemoryStorageAdapter } from "./in-memory-storage-adapter";
import { S3StorageAdapter } from "./s3-storage-adapter";
import type { StoragePort } from "./storage-port";
import { VercelBlobAdapter } from "./vercel-blob-adapter";

// Storage de contexts/media. Drivers:
// - "vercel-blob": Blob Store de verdade (produção Vercel). Exige BLOB_READ_WRITE_TOKEN.
// - "filesystem": disco do servidor, servido pela rota /api/media/file/[...key]. Pra instância
//   self-hosted (ex: servidor da rede local onde o Broadcast roda) que não deve mandar mídia pra
//   internet. Só suporta upload server-buffered — ver docs/media/filesystem-storage.md.
// - "s3": Amazon S3 (ou compatível: MinIO, Cloudflare R2). Exige S3_BUCKET — ver
//   s3-storage-adapter.ts e docs/media/s3-storage.md.
// - "local" (default): adapter em memória, sem persistência entre processos — dev/teste sem token.
// O adapter legado de disco (`LocalStorageAdapter`) foi descontinuado; "filesystem" é a
// reintrodução, agora com rota de servir sandboxed e sidecar de metadata.
function createStoragePort(): StoragePort {
  const driver = process.env.MEDIA_STORAGE_DRIVER ?? "local";

  switch (driver) {
    case "vercel-blob":
      return new VercelBlobAdapter();
    case "filesystem":
      return new FilesystemStorageAdapter();
    case "s3":
      return new S3StorageAdapter();
    case "local":
      return new InMemoryStorageAdapter();
    default:
      throw new Error(`Driver de storage desconhecido: "${driver}".`);
  }
}

export const storagePort: StoragePort = createStoragePort();

export type {
  DirectUploadKind,
  RemoteObjectSummary,
  StoragePort,
  StoragePutInput,
  StoredObject,
  UploadTicket,
  UploadTicketInput,
} from "./storage-port";
