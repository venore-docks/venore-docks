import { unzipSync, zipSync } from "fflate";

export const MANIFEST_ENTRY_NAME = "manifest.json";
export const ASSETS_DIR = "assets/";

export type ZipFileEntry = { path: string; data: Buffer };

// Limites de leitura de um .zip não confiável. O fflate aloca a saída de cada arquivo pelo
// tamanho descomprimido DECLARADO no diretório central (e nunca escreve além dele), então somar
// esse tamanho antes de extrair limita a memória de verdade — um zip-bomba estoura o teto
// declarado e é recusado sem descomprimir nada.
export type ZipReadLimits = {
  maxEntries: number;
  maxTotalUncompressedBytes: number;
  maxManifestBytes: number;
};

export const DEFAULT_ZIP_READ_LIMITS: ZipReadLimits = {
  maxEntries: 20_000,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxManifestBytes: 32 * 1024 * 1024,
};

export class ZipLimitError extends Error {}

// Único lugar que sabe empacotar/desempacotar o .zip do pacote de import/export — o resto do
// context só lida com manifest + Buffer de arquivo, nunca com fflate direto (mesmo raciocínio de
// storagePort isolar @vercel/blob do resto do domínio de media). Genérico sobre o tipo de
// manifest (não fixo em ExportManifest) porque outros contexts/plugins reaproveitam o mesmo
// envelope .zip pro próprio formato de pacote — ver academy/features/courses/export-course-bundle
// (barrel deste context reexporta esta função, único jeito de um plugin chegar nela sem violar o
// boundary de "só barrel + contracts/" de outro context).
export function buildExportZip<TManifest>(manifest: TManifest, files: ZipFileEntry[]): Buffer {
  const entries: Record<string, Uint8Array> = {
    [MANIFEST_ENTRY_NAME]: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  };
  for (const file of files) {
    entries[file.path] = new Uint8Array(file.data);
  }
  return Buffer.from(zipSync(entries, { level: 6 }));
}

export type ParsedExportZip = { manifest: unknown; files: Map<string, Buffer> };

export function parseExportZip(zipBuffer: Buffer, limits: Partial<ZipReadLimits> = {}): ParsedExportZip {
  const { maxEntries, maxTotalUncompressedBytes, maxManifestBytes } = { ...DEFAULT_ZIP_READ_LIMITS, ...limits };
  let entryCount = 0;
  let totalBytes = 0;

  const entries = unzipSync(new Uint8Array(zipBuffer), {
    filter: (file) => {
      // Só o manifest e a pasta de assets interessam — o resto nem é descomprimido.
      const wanted = file.name === MANIFEST_ENTRY_NAME || (file.name.startsWith(ASSETS_DIR) && !file.name.endsWith("/"));
      if (!wanted) return false;
      entryCount += 1;
      totalBytes += file.originalSize;
      if (entryCount > maxEntries) {
        throw new ZipLimitError(`O pacote tem mais de ${maxEntries} arquivos.`);
      }
      if (file.name === MANIFEST_ENTRY_NAME && file.originalSize > maxManifestBytes) {
        throw new ZipLimitError(`"${MANIFEST_ENTRY_NAME}" passa do limite de ${formatMegabytes(maxManifestBytes)}.`);
      }
      if (totalBytes > maxTotalUncompressedBytes) {
        throw new ZipLimitError(`O conteúdo descomprimido do pacote passa do limite de ${formatMegabytes(maxTotalUncompressedBytes)}.`);
      }
      return true;
    },
  });

  const manifestBytes = entries[MANIFEST_ENTRY_NAME];
  if (!manifestBytes) {
    throw new Error(`Arquivo "${MANIFEST_ENTRY_NAME}" não encontrado dentro do .zip.`);
  }

  const manifest: unknown = JSON.parse(new TextDecoder().decode(manifestBytes));

  const files = new Map<string, Buffer>();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith(ASSETS_DIR)) {
      files.set(path, Buffer.from(bytes));
    }
  }

  return { manifest, files };
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
