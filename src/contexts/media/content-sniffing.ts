// Confere o tipo declarado contra os primeiros bytes do arquivo ("magic bytes"). O Content-Type
// vem do cliente (ou do storage, que só repete o que o cliente mandou) — sem esta checagem dava
// pra subir um HTML/executável como "image/png" e ter o arquivo servido sob a origem do site.
//
// Precisa só do começo do arquivo: SNIFF_BYTES cobre o maior deslocamento usado abaixo (o
// cabeçalho %PDF- pode aparecer até o byte 1024).
export const SNIFF_BYTES = 1032;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function isMp3(bytes: Uint8Array): boolean {
  // Tag ID3v2 no começo, ou direto um frame MPEG (sync de 11 bits).
  return startsWith(bytes, ascii("ID3")) || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
}

function isPdf(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, SNIFF_BYTES)).toString("latin1");
  return head.includes("%PDF-");
}

function isSvg(bytes: Uint8Array): boolean {
  // Só descarta binário rotulado como SVG (byte nulo no começo) — se o texto é mesmo um SVG
  // válido quem decide é sanitizeSvgBuffer, logo em seguida, com mensagem de erro própria.
  return !Buffer.from(bytes.subarray(0, SNIFF_BYTES)).includes(0);
}

const MATCHERS: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  "image/gif": (bytes) => startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a")),
  "image/webp": (bytes) => startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8),
  "image/svg+xml": isSvg,
  "application/pdf": isPdf,
  "video/mp4": (bytes) => startsWith(bytes, ascii("ftyp"), 4),
  "video/webm": (bytes) => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]),
  "audio/mpeg": isMp3,
  "audio/wav": (bytes) => startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WAVE"), 8),
  "audio/ogg": (bytes) => startsWith(bytes, ascii("OggS")),
};

export function contentMatchesDeclaredType(contentType: string, bytes: Uint8Array): boolean {
  const matcher = MATCHERS[contentType];
  return matcher ? matcher(bytes) : false;
}

export const CONTENT_MISMATCH_ERROR = {
  code: "media.upload.content_mismatch",
  message: "O conteúdo do arquivo não corresponde ao tipo informado.",
} as const;
