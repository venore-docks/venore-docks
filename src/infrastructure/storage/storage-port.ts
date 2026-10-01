export type StoredObject = {
  key: string;
  url: string;
  size: number;
};

export type StoragePutInput = {
  key: string;
  data: Buffer;
  contentType: string;
  // Regravar uma key que já existe (padrão: erro no Vercel Blob). Só pra objeto derivado e
  // determinístico — ex: variante de imagem regerada pelo backfill depois de uma falha no meio.
  allowOverwrite?: boolean;
};

export type UploadTicketInput = {
  key: string;
  contentType: string;
  maxSizeBytes: number;
};

// Credencial de upload direto do client até o storage, sem o arquivo passar pelo servidor Next.
export type UploadTicket = {
  key: string;
  uploadUrl: string;
  token: string;
  expiresAt: Date;
};

export type RemoteObjectSummary = {
  key: string;
  size: number;
  uploadedAt: Date;
};

export type StoredObjectInfo = { size: number; contentType: string };

export type ByteRange = { start: number; end: number };

export type StoredObjectBody = {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  // Presente quando o pedido de range foi atendido (206).
  range: ByteRange | null;
};

export interface StoragePort {
  /** Upload server-buffered — o servidor já tem os bytes em memória (arquivos pequenos). */
  store(input: StoragePutInput): Promise<StoredObject>;

  /** Remove definitivamente o objeto. Idempotente: remover uma key inexistente não é erro. */
  remove(key: string): Promise<void>;

  /** Resolve a URL pública/servível de uma key já armazenada, sem round-trip à rede. */
  resolveUrl(key: string): string;

  /**
   * Emite uma credencial de upload direto do browser até o storage (blob-spec seção 7/9) —
   * necessária para arquivos que excedem o limite de body de uma function.
   */
  createUploadTicket(input: UploadTicketInput): Promise<UploadTicket>;

  /**
   * Lista objetos existentes no storage, para reconciliação (blob-spec seção 8) — nunca usado
   * no caminho síncrono de upload/delete, só por `reconcileOrphanUploads`.
   */
  listObjects(prefix?: string): Promise<RemoteObjectSummary[]>;

  /** Metadado real do objeto no storage (tamanho/tipo), ou null se não existe. */
  stat(key: string): Promise<StoredObjectInfo | null>;

  /** Lê o objeto em streaming (com range opcional) — usado pela rota que serve mídia autorizada. */
  read(key: string, range?: ByteRange | null): Promise<StoredObjectBody | null>;

  /**
   * true quando a URL do storage (resolveUrl) é servível publicamente sem passar pelo app.
   * false = todo acesso passa pela rota autorizada (/api/media/asset/[id]).
   */
  servesPublicly(): boolean;
}
