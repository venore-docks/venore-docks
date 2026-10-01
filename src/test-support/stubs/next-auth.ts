// Stub de "next-auth" usado só por vitest.integration.config.ts (alias por regex exato — não
// intercepta "next-auth/providers/*" nem "next-auth/adapters", que continuam resolvendo pro
// pacote real). Necessário porque next-auth resolve "next/server" internamente
// (next-auth/lib/env.js), um subpath que o package.json do Next não declara em "exports" — só
// resolve dentro do bundler do próprio Next.js, nunca num processo Node/Vitest puro.
//
// Nenhum teste de integração chama handlers/signIn/signOut/auth de verdade — todo mundo bypassa
// handler.ts (e authorizeActor) chamando service.ts diretamente, mesmo padrão dos service.test.ts
// unitários. O stub só precisa existir pra src/contexts/auth/auth.config.ts terminar de avaliar
// no import (a chamada `NextAuth({...})` no top-level do módulo).
export default function NextAuthStub() {
  return {
    handlers: {
      GET: async () => new Response(null, { status: 501 }),
      POST: async () => new Response(null, { status: 501 }),
    },
    auth: async () => null,
    signIn: async () => {
      throw new Error("next-auth está stubado nos testes de integração — signIn não deveria ser chamado aqui.");
    },
    signOut: async () => {
      throw new Error("next-auth está stubado nos testes de integração — signOut não deveria ser chamado aqui.");
    },
  };
}

// Classes de erro que o app estende (contexts/auth/contracts/login-errors.ts) — o pacote real as
// reexporta de @auth/core/errors; aqui basta a mesma forma (`code` + `type`).
export class AuthError extends Error {
  type = "AuthError";
}

export class CredentialsSignin extends AuthError {
  code = "credentials";
  type = "CredentialsSignin";
}
