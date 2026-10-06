// Leitura de sistema para a leitura em voz alta (platform/speech): só entry publicada, pública
// (visitante anônimo pode ler — o MP3 gerado é público) e editorial (internalOwner null).
export type PublishedEntryText = { id: string; updatedAt: Date; text: string };
export type ListPublishedEntryTextsQuery = { updatedAfter: Date | null; limit: number };
