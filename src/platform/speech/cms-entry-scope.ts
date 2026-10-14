// Scope do áudio de uma entry do CMS em contexts/speech (um áudio por entry, item "body").
export const CMS_ENTRY_SPEECH_PREFIX = "cms.entry:";

export const cmsEntrySpeechScope = (entryId: string) => `${CMS_ENTRY_SPEECH_PREFIX}${entryId}`;
