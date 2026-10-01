// Sem authorizeActor: registro é ação anônima (visitante sem sessão), não há ator pra autorizar.
// A porta de entrada é o Server Action em src/app/(auth)/actions.ts, que só a expõe quando o
// provider de senha está habilitado. O controle de acesso ao sistema é o status "pending" +
// aprovação do superadmin (src/platform/registration/handle-user-registered.ts), aplicado pelo
// chamador logo após este handler.
import { listAvailableAuthProviders } from "../../../providers";
import { registerWithPassword } from "./service";
import type { RegisterWithPasswordInput, RegisterWithPasswordResult } from "./types";

export async function registerWithPasswordHandler(
  input: RegisterWithPasswordInput,
): Promise<RegisterWithPasswordResult> {
  // A tela esconde "Criar conta" quando o login por senha está desligado, mas a Server Action é
  // um endpoint público — sem esta checagem dava pra criar conta com senha numa instância só-OAuth
  // (e pré-registrar o e-mail de alguém, travando o login OAuth dessa pessoa).
  const passwordEnabled = listAvailableAuthProviders().some((provider) => provider.kind === "password" && provider.enabled);
  if (!passwordEnabled) {
    return {
      success: false,
      error: { code: "auth.registration.password_disabled", message: "O cadastro com senha não está habilitado neste site." },
    };
  }

  return registerWithPassword(input);
}
