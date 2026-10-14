import { findSpeechMediaUsage } from "@/contexts/speech";
import { CMS_ENTRY_SPEECH_PREFIX as CMS_ENTRY_PREFIX } from "@/platform/speech/cms-entry-scope";
import type { MediaUsageReference } from "./types";

// MP3 da leitura em voz alta: apagar pela biblioteca deixaria o player do conteúdo quebrado. O
// áudio some sozinho quando o texto sai de publicação; regerar depende de republicar.
export async function findSpeechMediaUsageReferences(mediaId: string): Promise<MediaUsageReference[]> {
  const result = await findSpeechMediaUsage(mediaId);
  if (!result.success) return [];
  return result.data.map((clip) => {
    const entryId = clip.scope.startsWith(CMS_ENTRY_PREFIX) ? clip.scope.slice(CMS_ENTRY_PREFIX.length) : null;
    return {
      consumerKey: "speech",
      consumerLabel: "Leitura em voz alta",
      label: entryId ? `Áudio da entry (${clip.locale})` : `Áudio de ${clip.scope} (${clip.locale})`,
      href: entryId ? `/admin/cms/entries/${entryId}` : "/admin/settings",
    };
  });
}
