import { getCurrentUser } from "@/contexts/auth";
import { listOwnAuthoredEntries } from "./service";
import type { ListOwnAuthoredEntriesResult } from "./types";

// Conteúdos de que a própria pessoa é autora — "baixar meus dados".
export async function listOwnAuthoredEntriesHandler(): Promise<ListOwnAuthoredEntriesResult> {
  const current = await getCurrentUser();
  if (!current.success || !current.data) {
    return { success: false, error: { code: "cms.unauthenticated", message: "É necessário estar autenticado." } };
  }
  return listOwnAuthoredEntries(current.data.id);
}
