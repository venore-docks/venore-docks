import type { DefaultSession } from "next-auth";
import type { UserRegistrationStatus } from "./contracts/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      // Preenchido no callback session de auth.config.ts a partir do banco. `undefined` quando
      // ainda não resolvido; "pending" faz getCurrentUser recusar a sessão (P9).
      status?: UserRegistrationStatus;
      // Provider usado NESTA sessão ("credentials" | "google" | "github" | "microsoft-entra-id"),
      // capturado uma vez no jwt() callback a partir de `account.provider` no momento do login e
      // persistido no token daí em diante (account só vem preenchido na chamada de sign-in, não em
      // toda leitura do JWT). Sessão criada antes desta feature existir chega aqui `undefined` até
      // a pessoa logar de novo — get-current-user/view.ts trata isso como "não editável" por
      // segurança (ver AuthenticatedUser.authProvider).
      provider?: string;
    } & DefaultSession["user"];
  }
}
