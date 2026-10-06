// Leitura de sistema para a leitura em voz alta (platform/speech): só entry com a opção "Gerar
// áudio" ligada, publicada, pública (o MP3 gerado é público) e editorial (internalOwner null).
export type PublishedEntryText = { id: string; updatedAt: Date; text: string };
export type ListPublishedEntryTextsQuery = { updatedAfter: Date | null; limit: number };
