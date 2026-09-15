import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
// Seção 1 do AGENTS.md: providers.ts não alcança mais o `store.ts` da feature direto — passa pelo
// handler (o entrypoint que o barrel ./index.ts reexporta como `findUserByEmail`). Importa o
// handler e não o próprio ./index.ts só porque ./index.ts reexporta ./auth.config, que avalia
// `NextAuth({...})` no top-level e puxa `next/server` — inresolvível em Vitest puro (AGENTS.md
// seção 5), e este arquivo roda em teste unitário.
import { findUserByEmailHandler as findUserByEmail } from "./features/identity/find-user-by-email/handler";
import { verifyPasswordHash } from "./features/identity/password-hashing";
import type { AuthProviderDescriptor } from "./contracts/types";

function readEnvValue(key: string): string {
  const rawValue = process.env[key];
  if (typeof rawValue !== "string") return "";
  return rawValue.trim().replace(/^['"]|['"]$/g, "");
}

function readFirstEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = readEnvValue(key);
    if (value) return value;
  }
  return "";
}

function hasRequiredProviderEnv(keys: string[]): boolean {
  return keys.every((key) => Boolean(readEnvValue(key)));
}

function hasRequiredProviderEnvAliases(keyGroups: string[][]): boolean {
  return keyGroups.every((aliases) => Boolean(readFirstEnvValue(aliases)));
}

function isDevelopmentCredentialsEnabled(): boolean {
  // Atalho de dev (usuário/senha sem linha no banco) só fora de produção E com o flag exato.
  return process.env.NODE_ENV !== "production" && readEnvValue("AUTH_ENABLE_DEV_CREDENTIALS") === "true";
}

function isCredentialsDisabled(): boolean {
  // Kill-switch explícito: AUTH_DISABLE_CREDENTIALS="true" (exato) sempre vence e remove o provider
  // Credentials, mesmo que AUTH_ENABLE_CREDENTIALS esteja setado.
  return readEnvValue("AUTH_DISABLE_CREDENTIALS") === "true";
}

function isCredentialsExplicitlyEnabled(): boolean {
  // Opt-in, mesmo esquema do OAuth: a env existe (="true" exato) -> provider ligado.
  return readEnvValue("AUTH_ENABLE_CREDENTIALS") === "true";
}

// O provider Credentials (login por senha) fica ligado quando: AUTH_ENABLE_CREDENTIALS="true"
// (opt-in explícito) OU nenhum provider OAuth está configurado (rede de segurança — o /setup e
// setOwnPassword/adminSetUserPassword dependem dele, e um deploy novo não pode ficar sem forma de
// entrar). AUTH_DISABLE_CREDENTIALS="true" sempre desliga.
function isCredentialsEnabled(activeOAuthProviderCount: number): boolean {
  if (isCredentialsDisabled()) return false;
  if (isCredentialsExplicitlyEnabled()) return true;
  return activeOAuthProviderCount === 0;
}

function readGithubCredentials(): { clientId: string; clientSecret: string } | null {
  if (!hasRequiredProviderEnvAliases([["GITHUB_ID", "AUTH_GITHUB_ID"], ["GITHUB_SECRET", "AUTH_GITHUB_SECRET"]])) {
    return null;
  }
  return {
    clientId: readFirstEnvValue(["GITHUB_ID", "AUTH_GITHUB_ID"]),
    clientSecret: readFirstEnvValue(["GITHUB_SECRET", "AUTH_GITHUB_SECRET"]),
  };
}

function readGoogleCredentials(): { clientId: string; clientSecret: string } | null {
  if (hasRequiredProviderEnv(["GOOGLE_ID", "GOOGLE_SECRET"])) {
    return { clientId: readEnvValue("GOOGLE_ID"), clientSecret: readEnvValue("GOOGLE_SECRET") };
  }
  if (hasRequiredProviderEnv(["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"])) {
    return { clientId: readEnvValue("AUTH_GOOGLE_ID"), clientSecret: readEnvValue("AUTH_GOOGLE_SECRET") };
  }
  return null;
}

function readMicrosoftCredentials(): { clientId: string; clientSecret: string; issuer: string } | null {
  if (!hasRequiredProviderEnv(["MICROSOFT_ID", "MICROSOFT_SECRET", "MICROSOFT_ISSUER"])) {
    return null;
  }
  return {
    clientId: readEnvValue("MICROSOFT_ID"),
    clientSecret: readEnvValue("MICROSOFT_SECRET"),
    issuer: readEnvValue("MICROSOFT_ISSUER"),
  };
}

export function buildAuthProviders() {
  const providers = [];

  const github = readGithubCredentials();
  if (github) {
    providers.push(GitHub({ clientId: github.clientId, clientSecret: github.clientSecret }));
  }

  const google = readGoogleCredentials();
  if (google) {
    providers.push(Google({ clientId: google.clientId, clientSecret: google.clientSecret }));
  }

  const microsoft = readMicrosoftCredentials();
  if (microsoft) {
    providers.push(
      MicrosoftEntraID({
        clientId: microsoft.clientId,
        clientSecret: microsoft.clientSecret,
        issuer: microsoft.issuer,
      }),
    );
  }

  const oauthProviderCount = providers.length;
  if (!isCredentialsEnabled(oauthProviderCount)) {
    return providers;
  }
  if (!isCredentialsExplicitlyEnabled() && !isCredentialsDisabled() && oauthProviderCount === 0) {
    console.warn(
      '[auth] Nenhum provider OAuth configurado e AUTH_ENABLE_CREDENTIALS não definido — o login ' +
        'por senha foi ligado automaticamente pra não trancar o acesso. Defina ' +
        'AUTH_ENABLE_CREDENTIALS="true" pra torná-lo explícito, ou configure um provider OAuth.',
    );
  }

  providers.push(
    Credentials({
      name: "Senha",
      credentials: {
        username: { label: "Email ou usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!username || !password) return null;

        // Email é sempre salvo em lowercase no registro — sem normalizar aqui, um login com
        // maiúscula não acha o usuário e cai (incorretamente) no fallback de dev credentials
        // quando AUTH_ENABLE_DEV_CREDENTIALS está ligado, ou num "senha inválida" genérico.
        const found = await findUserByEmail({ email: username.toLowerCase() });
        if (found.success && found.data.passwordHash) {
          if (!(await verifyPasswordHash(password, found.data.passwordHash))) return null;
          // P9 (generalizado) — só "approved" autentica por senha; pending/rejected/frozen/removed
          // são todos recusados aqui (ver get-current-user/service.ts pro mesmo racional do lado
          // de sessão já estabelecida).
          if (found.data.status !== "approved") return null;

          return {
            id: found.data.id,
            name: found.data.name ?? username,
            email: found.data.email,
          };
        }

        if (!isDevelopmentCredentialsEnabled()) return null;
        return { id: `dev-${username}`, name: username, email: `${username}@dev.local` };
      },
    }),
  );

  return providers;
}

export function listAvailableAuthProviders(): AuthProviderDescriptor[] {
  const github = readGithubCredentials();
  const google = readGoogleCredentials();
  const microsoft = readMicrosoftCredentials();
  const oauthProviderCount = [github, google, microsoft].filter((entry) => entry !== null).length;
  return [
    { key: "github", label: "GitHub", kind: "oauth", enabled: github !== null },
    {
      key: "google",
      label: "Google",
      kind: "oauth",
      enabled: google !== null,
      iconUrl: "/providers/google.svg",
    },
    {
      key: "microsoft-entra-id",
      label: "Microsoft",
      kind: "oauth",
      enabled: microsoft !== null,
      iconUrl: "/providers/microsoft.svg",
    },
    { key: "credentials", label: "Senha", kind: "password", enabled: isCredentialsEnabled(oauthProviderCount) },
  ];
}

export {
  hasRequiredProviderEnv,
  hasRequiredProviderEnvAliases,
  isCredentialsDisabled,
  isCredentialsEnabled,
  isCredentialsExplicitlyEnabled,
  isDevelopmentCredentialsEnabled,
  readEnvValue,
  readFirstEnvValue,
};
