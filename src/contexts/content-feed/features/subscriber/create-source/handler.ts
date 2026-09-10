import { authorizeActor } from "@/contexts/rbac";
import { createSource } from "./service";
import type { CreateSourceInput, CreateSourceResult } from "./types";

function isValidRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createSourceHandler(input: CreateSourceInput): Promise<CreateSourceResult> {
  if (input.name.trim().length === 0) {
    return { success: false, error: { code: "content-feed.sources.invalid_name", message: "O nome da fonte não pode ser vazio." } };
  }

  if (!isValidRemoteUrl(input.remoteUrl)) {
    return {
      success: false,
      error: { code: "content-feed.sources.invalid_remote_url", message: "A URL remota precisa ser um endereço http(s) válido." },
    };
  }

  if (input.connectionKey.trim().length === 0) {
    return {
      success: false,
      error: { code: "content-feed.sources.invalid_connection_key", message: "A chave de conexão não pode ser vazia." },
    };
  }

  const authz = await authorizeActor("content-feed.sources.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return createSource({ ...input, actorId: authz.actorId });
}
