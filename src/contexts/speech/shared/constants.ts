// Categoria reservada da biblioteca de mídia onde os MP3 gerados ficam.
export const SPEECH_MEDIA_CATEGORY_KEY = "speech";
export const SPEECH_MEDIA_CATEGORY_NAME = "Leitura em voz alta";

// Texto acima disso não ganha áudio. No modo worker o MP3 volta no corpo de uma requisição, e a
// Vercel corta corpo acima de 4,5 MB (~18 min de fala a 32 kbps). Artigo desse tamanho é raro;
// cena de graphic novel nunca chega perto.
export const MAX_ITEM_CHARACTERS = 15_000;
export const MAX_WORKER_AUDIO_BYTES = 4_400_000;
export const MAX_ITEMS_PER_SCOPE = 5_000;

// Falha do provedor (rede, 5xx, chave errada) tenta de novo nos próximos ticks até este número.
export const MAX_SYNTHESIS_ATTEMPTS = 3;
