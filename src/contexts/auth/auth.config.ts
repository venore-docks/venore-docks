import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import { db } from "@/infrastructure/database/client";
import { handleUserRegistered } from "@/platform/registration/handle-user-registered";
import * as schema from "./database/schema";
// Composition root do context de auth (mesmo raciocínio de importar `buildAuthProviders` e
// `./database/schema` direto): este arquivo não pode passar pelo barrel `./index.ts` sem ciclo,
// então lê o status de registro pelo store da feature diretamente.
import { findUserStatusById } from "./features/session/get-current-user-registration-status/store";
import { recordUserLogin } from "./features/session/record-user-login/store";
import { buildAuthProviders } from "./providers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js v5 exige trustHost em self-host — sem plataforma "confiável" (Vercel/Netlify) pra
  // inferir sozinho, ele recusa a request pelo header Host. O plugin broadcast roda em LAN, então
  // o host nunca é um domínio público conhecido (docs/venore-docks.md — Autenticação).
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: buildAuthProviders(),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub);
        // P9 — usuário "pending" não pode autenticar nada: o redirect em (platform)/layout.tsx
        // não cobre Server Actions nem /api. O status vai pra sessão aqui e getCurrentUser
        // (o ponto que todo authorizeActor e handler self-service consulta) recusa a sessão
        // pending. A tela /pending-approval usa getCurrentUserRegistrationStatus (lê status
        // direto), não getCurrentUser, então continua funcionando.
        session.user.status = (await findUserStatusById(session.user.id)) ?? undefined;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      await handleUserRegistered({
        id: user.id!,
        email: user.email ?? null,
        name: user.name ?? null,
      });
    },
    // Alimenta a aba de atividade do perfil admin (/admin/community/[userId]) — dispara em todo
    // login bem-sucedido (credentials ou OAuth), não a cada request como o callback session()
    // acima, então não pesa.
    async signIn({ user }) {
      if (user.id) await recordUserLogin(user.id);
    },
  },
});
