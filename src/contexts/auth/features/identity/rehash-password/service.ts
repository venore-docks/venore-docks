import { hashPassword, needsRehash } from "../password-hashing";
import { replacePasswordHash } from "./store";
import type { RehashPasswordCommand, RehashPasswordResult } from "./types";

// Regrava o hash no formato/parâmetros atuais logo depois de um login bem-sucedido (a senha em
// claro só existe nesse momento). No-op quando o hash já está atualizado.
export async function rehashPassword(command: RehashPasswordCommand): Promise<RehashPasswordResult> {
  if (!needsRehash(command.storedHash)) {
    return { success: true, data: { rehashed: false } };
  }
  const nextHash = await hashPassword(command.password);
  const rehashed = await replacePasswordHash(command.userId, command.storedHash, nextHash);
  return { success: true, data: { rehashed } };
}
