// Sem authorizeActor: chamado só pelo authorize() do provider Credentials (providers.ts), depois
// que a senha informada JÁ bateu com o hash guardado — não é ação de um ator sobre outro.
import { rehashPassword } from "./service";
import type { RehashPasswordCommand, RehashPasswordResult } from "./types";

export async function rehashPasswordHandler(command: RehashPasswordCommand): Promise<RehashPasswordResult> {
  return rehashPassword(command);
}
