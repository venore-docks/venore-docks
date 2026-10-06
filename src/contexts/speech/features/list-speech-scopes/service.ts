import { listScopesWithPrefix } from "../../shared/store";

// Scopes com áudio cujo nome começa com `prefix` ("cms.entry:") — para quem reconcilia o que saiu
// de publicação.
export async function listSpeechScopes(prefix: string): Promise<string[]> {
  return listScopesWithPrefix(prefix);
}
