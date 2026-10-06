// Categoria reservada da biblioteca de mídia onde os MP3 gerados ficam.
export const SPEECH_MEDIA_CATEGORY_KEY = "speech";
export const SPEECH_MEDIA_CATEGORY_NAME = "Leitura em voz alta";

// Texto acima disso não ganha áudio: o MP3 passaria do limite de 20 MB de audio/mpeg da mídia
// (~45 min de fala). Artigo desse tamanho é raro; cena de graphic novel nunca chega perto.
export const MAX_ITEM_CHARACTERS = 30_000;
export const MAX_ITEMS_PER_SCOPE = 5_000;

// Falha do provedor (rede, 5xx, chave errada) tenta de novo nos próximos ticks até este número.
export const MAX_SYNTHESIS_ATTEMPTS = 3;
