// Tipo a declarar no upload de mídia. Normalmente é o `file.type` do navegador, mas fora do Safari
// o navegador não conhece HEIC/HEIF (foto de iPhone): Chrome/Edge no Windows mandam o arquivo com
// tipo vazio, que virava "application/octet-stream" e era recusado. Nesses casos o tipo sai da
// extensão — o servidor confere os bytes de qualquer jeito (contexts/media/content-sniffing.ts),
// então isso não abre brecha nenhuma.
const TYPE_BY_EXTENSION: Record<string, string> = {
  heic: "image/heic",
  heif: "image/heif",
};

export function resolveUploadContentType(filename: string, browserType: string): string {
  if (browserType && browserType !== "application/octet-stream") return browserType;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}
