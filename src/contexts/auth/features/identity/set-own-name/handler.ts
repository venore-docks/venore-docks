import { getCurrentUserService } from "../../session/get-current-user/service";
import { setOwnName } from "./service";
import type { SetOwnNameInput, SetOwnNameResult } from "./types";

// Self-service: o ator é sempre a sessão atual — não há permission pra editar o próprio nome
// (mesmo raciocínio de set-own-password/update-own-avatar). Sem RBAC, mas com uma checagem própria
// que nenhuma das outras duas tem: só quem logou por "credentials" pode editar — conta OAuth
// recebe o nome do provedor a cada login (auth.config.ts jwt() callback) e editar manualmente
// aqui seria sobrescrito no próximo login mesmo assim, então nem vale a pena permitir (pedido do
// dono). `authProvider` vem da sessão atual (JWT), não é permanente por usuário — se a pessoa
// nunca logou de novo desde antes desta feature existir, authProvider é `null` e cai no mesmo
// bloqueio, por segurança (P9-like fail-closed).
export async function setOwnNameHandler(input: SetOwnNameInput): Promise<SetOwnNameResult> {
  const currentUser = await getCurrentUserService();
  if (!currentUser.success || !currentUser.data) {
    return {
      success: false,
      error: {
        code: "auth.identity.unauthenticated",
        message: "É necessário estar autenticado para executar esta operação.",
      },
    };
  }

  if (currentUser.data.authProvider !== "credentials") {
    return {
      success: false,
      error: {
        code: "auth.identity.name_managed_by_provider",
        message: "Contas conectadas por login social têm o nome definido pelo provedor — não é possível editar aqui.",
      },
    };
  }

  return setOwnName({ actorId: currentUser.data.id, name: input.name });
}
