import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { resolveWithinRoot } from "./filesystem-path";
import type {
  DirectUploadKind,
  ByteRange,
  RemoteObjectSummary,
  StoragePort,
  StoragePutInput,
  StoredObject,
  StoredObjectBody,
  StoredObjectInfo,
  UploadTicket,
} from "./storage-port";

// Sidecar com o contentType/size/uploadedAt de cada objeto — o disco não guarda o MIME e derivar
// só da extensão erra em alguns casos (a extensão pode mentir). Um arquivo pequeno ao lado de
// cada objeto: sem race de escrita concorrente (diferente de um manifesto único), self-contained.
const META_SUFFIX = ".meta.json";

// Onde o driver filesystem grava. Default relativo ao cwd (raiz do projeto em `next dev`/`next
// start` self-hosted). Fora de public/ de propósito: os arquivos são servidos SÓ pela rota
// sandboxed /api/media/file/[...key], nunca como asset estático. Pode ser um caminho absoluto
// (ex: um mount de NAS).
export function getFilesystemStorageRoot(): string {
  return path.resolve(process.env.MEDIA_FILESYSTEM_ROOT?.trim() || "./media-storage");
}

// Base da URL que o browser/TV usa pra buscar o arquivo. Default relativo — resolve contra a
// origem de quem serviu a página (o servidor local). Só precisa de valor absoluto se a mídia
// morar num host/porta diferente do app.
function getFilesystemPublicBase(): string {
  return (process.env.MEDIA_FILESYSTEM_PUBLIC_URL?.trim() || "/api/media/file").replace(/\/+$/, "");
}

// Lida pela rota de servir (/api/media/file/[...key]/route.ts) — o contentType autoritativo é o
// que o upload gravou, não um palpite pela extensão. null quando não há sidecar (ou está corrompido).
export async function readFilesystemObjectContentType(key: string): Promise<string | null> {
  const target = resolveWithinRoot(getFilesystemStorageRoot(), key);
  if (!target) return null;
  try {
    const raw = await readFile(`${target}${META_SUFFIX}`, "utf8");
    const parsed = JSON.parse(raw) as { contentType?: unknown };
    return typeof parsed.contentType === "string" && parsed.contentType.length > 0 ? parsed.contentType : null;
  } catch {
    return null;
  }
}

// Storage em disco pra instância self-hosted (ex: servidor da rede local onde o Broadcast roda) —
// as imagens/PDFs da biblioteca de mídia ficam num diretório do servidor e são servidos pela rota
// /api/media/file/[...key], em vez de irem pro Vercel Blob. Ver docs/media/filesystem-storage.md.
//
// Só o caminho SERVER-BUFFERED (storagePort.store) é suportado. O upload direto do browser
// (createUploadTicket) depende de um endpoint externo estilo Blob que não existe aqui — cai num
// erro claro; arquivos grandes precisam do driver "vercel-blob". Os vídeos do Broadcast NÃO
// passam por este storage: ficam em public/broadcast/videos e são servidos pela rota do próprio
// plugin.
export class FilesystemStorageAdapter implements StoragePort {
  private readonly root = getFilesystemStorageRoot();
  private readonly publicBase = getFilesystemPublicBase();

  async store(input: StoragePutInput): Promise<StoredObject> {
    const target = resolveWithinRoot(this.root, input.key);
    if (!target) {
      throw new Error(`Chave de storage inválida (fora da raiz): "${input.key}".`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.data);
    await writeFile(
      `${target}${META_SUFFIX}`,
      JSON.stringify({ contentType: input.contentType, size: input.data.byteLength, uploadedAt: new Date().toISOString() }),
    );
    return { key: input.key, url: this.resolveUrl(input.key), size: input.data.byteLength };
  }

  async remove(key: string): Promise<void> {
    const target = resolveWithinRoot(this.root, key);
    if (!target) return;
    await unlink(target).catch(() => {});
    await unlink(`${target}${META_SUFFIX}`).catch(() => {});
  }

  resolveUrl(key: string): string {
    const encoded = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.publicBase}/${encoded}`;
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    const target = resolveWithinRoot(this.root, key);
    if (!target) return null;
    try {
      const info = await stat(target);
      if (!info.isFile()) return null;
      const contentType = (await readFilesystemObjectContentType(key)) ?? "application/octet-stream";
      return { size: info.size, contentType };
    } catch {
      return null;
    }
  }

  // Streaming de verdade (com range) — antes a rota lia o arquivo inteiro pra memória a cada
  // requisição, inclusive pra servir 1 KB de um vídeo de 200 MB.
  async read(key: string, range?: ByteRange | null): Promise<StoredObjectBody | null> {
    const info = await this.stat(key);
    const target = resolveWithinRoot(this.root, key);
    if (!info || !target) return null;
    const effective = range && range.start <= range.end && range.end < info.size ? range : null;
    const nodeStream = createReadStream(target, effective ? { start: effective.start, end: effective.end } : undefined);
    return {
      body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      size: info.size,
      contentType: info.contentType,
      range: effective,
    };
  }

  servesPublicly(): boolean {
    return true;
  }

  directUploadKind(): DirectUploadKind {
    return "unsupported";
  }

  async createUploadTicket(): Promise<UploadTicket> {
    throw new Error(
      'O driver de storage "filesystem" não suporta upload direto do browser (arquivos grandes). ' +
        'Use o upload server-buffered, ou o driver "vercel-blob". Ver docs/media/filesystem-storage.md.',
    );
  }

  async listObjects(prefix?: string): Promise<RemoteObjectSummary[]> {
    const out: RemoteObjectSummary[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
          continue;
        }
        if (!entry.isFile() || entry.name.endsWith(META_SUFFIX)) continue;
        const key = path.relative(this.root, abs).split(path.sep).join("/");
        if (prefix && !key.startsWith(prefix)) continue;
        const info = await stat(abs);
        out.push({ key, size: info.size, uploadedAt: info.mtime });
      }
    };

    await walk(this.root);
    return out;
  }
}
