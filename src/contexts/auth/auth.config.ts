import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import { db } from "@/infrastructure/database/client";
import { handleUserRegistered } from "@/platform/registration/handle-user-registered";
import { isSelfRegistrationEnabled } from "@/platform/registration/registration-settings";
import * as schema from "./database/schema";
// Composition root do context de auth (mesmo raciocínio de importar `buildAuthProviders` e
// `./database/schema` direto): este arquivo não pode passar pelo barrel `./index.ts` sem ciclo,
// então lê o status de registro pelo store da feature diretamente.
import { findSessionState, findSessionVersion } from "./features/session/revoke-sessions/store";
import { verifySessionVersionProof } from "./features/session/revoke-sessions/session-version-proof";
import type { UserRegistrationStatus } from "./contracts/types";
import { findUserByEmailHandler } from "./features/identity/find-user-by-email/handler";
import { recordUserLogin } from "./features/session/record-user-login/store";
import { syncUserNameFromProvider } from "./features/session/sync-oauth-name/store";
import { buildAuthProviders } from "./providers";

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
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
  // Telas próprias: /api/auth/signin (página padrão do Auth.js, em inglês) vira /login, e erro de
  // OAuth (ex: OAuthAccountNotLinked) cai em /login?error=<tipo>, mapeado pra mensagem em PT.
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Autocadastro fechado (/admin/settings): o primeiro login OAuth de alguém sem conta seria um
    // cadastro — recusado aqui, antes do adapter criar o usuário. Quem já tem conta entra normal.
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) return "/login?error=AccessDenied";
      const existing = await findUserByEmailHandler({ email });
      if (existing.success) return true;
      if (await isSelfRegistrationEnabled()) return true;
      return "/login?error=registration-closed";
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (user) token.id = user.id;
      // Versão de sessão do login (revoke-sessions). Na renovação ("update") só com a prova
      // assinada pelo servidor (renew-current-session.ts): o cliente também dispara "update" e,
      // sem a prova, uma sessão revogada se renovaria sozinha.
      if (user && token.id) {
        token.sv = (await findSessionVersion(String(token.id))) ?? 0;
      } else if (trigger === "update" && token.id) {
        const current = (await findSessionVersion(String(token.id))) ?? 0;
        const proof = (session as { svProof?: unknown } | undefined)?.svProof;
        if (verifySessionVersionProof(String(token.id), current, proof)) token.sv = current;
      }
      // account/profile só vêm preenchidos na chamada de sign-in (trigger "signIn"/"signUp"),
      // nunca nas leituras seguintes do mesmo JWT — por isso o provider fica gravado no token daí
      // pra frente, ao contrário do status (que é revalidado no banco a cada request).
      if (account) {
        token.provider = account.provider;
        // Nome de conta OAuth é sempre "o que o provedor manda" (pedido do dono: só quem loga por
        // senha edita o próprio nome em /account, ver set-own-name). Sincroniza a cada login OAuth
        // — se a pessoa mudar o nome no Google/GitHub/Microsoft, reflete aqui no próximo login.
        if (account.provider !== "credentials" && profile?.name && user.id) {
          await syncUserNameFromProvider(user.id, profile.name);
          // Sem isso o token.name fica congelado no valor de quando a sessão JWT foi emitida —
          // syncUserNameFromProvider corrige o banco, mas session() só repassa token.name adiante
          // sem reler o banco (só status é revalidado ali), então a tela /account continuaria
          // mostrando o nome velho (às vezes o e-mail, se foi o valor original) pelo resto da
          // validade do JWT.
          token.name = profile.name;
        }
      }
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
        // Sessão emitida antes de um "sair de todos os dispositivos"/troca de senha fica sem
        // status (getCurrentUser só aceita "approved"). Token sem `sv` (anterior a esta versão)
        // vale 0 — o default da coluna —, então o deploy não desloga ninguém.
        const state = await findSessionState(session.user.id);
        const tokenVersion = typeof token.sv === "number" ? token.sv : 0;
        session.user.status =
          state && state.sessionVersion === tokenVersion ? (state.status as UserRegistrationStatus) : undefined;
        session.user.provider = typeof token.provider === "string" ? token.provider : undefined;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Fail-closed: se a composição falhar, a conta continua "pending" (default do schema).
      const result = await handleUserRegistered({
        id: user.id!,
        email: user.email ?? null,
        name: user.name ?? null,
      });
      if (!result.success) {
        console.error(`[auth] composição de registro falhou para ${user.id} — conta segue pendente.`, result.error);
      }
    },
    // Alimenta a aba de atividade do perfil admin (/admin/community/[userId]) — dispara em todo
    // login bem-sucedido (credentials ou OAuth), não a cada request como o callback session()
    // acima, então não pesa.
    async signIn({ user }) {
      if (user.id) await recordUserLogin(user.id);
    },
  },
});
