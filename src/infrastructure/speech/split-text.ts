// A API do Google recusa entrada acima de 5 000 bytes por requisição. Texto longo vira vários
// pedaços, cortados no limite mais natural que couber: parágrafo, depois frase, depois palavra.
export const MAX_CHUNK_BYTES = 4_500;

const byteLength = (text: string) => Buffer.byteLength(text, "utf8");

function splitBy(text: string, pattern: RegExp): string[] {
  return text.split(pattern).map((part) => part.trim()).filter(Boolean);
}

function packParts(parts: string[], separator: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const candidate = current ? `${current}${separator}${part}` : part;
    if (byteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = part;
  }
  if (current) chunks.push(current);
  return chunks;
}

// Palavra sozinha maior que o limite (improvável fora de lixo) é cortada por caractere.
function hardSplit(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of text) {
    if (byteLength(current + char) > maxBytes) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitTextForSynthesis(text: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  if (byteLength(normalized) <= maxBytes) return [normalized];

  const levels: { pattern: RegExp; separator: string }[] = [
    { pattern: /\n\s*\n/, separator: "\n\n" },
    { pattern: /(?<=[.!?…。！？])\s+/, separator: " " },
    { pattern: /\s+/, separator: " " },
  ];

  const split = (piece: string, level: number): string[] => {
    if (byteLength(piece) <= maxBytes) return [piece];
    if (level >= levels.length) return hardSplit(piece, maxBytes);
    const { pattern, separator } = levels[level];
    const parts = splitBy(piece, pattern).flatMap((part) => split(part, level + 1));
    return packParts(parts, separator, maxBytes);
  };

  return split(normalized, 0);
}
