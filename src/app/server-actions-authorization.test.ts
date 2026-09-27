// Rede de segurança pras Server Actions: toda função exportada de um arquivo "use server" é um
// endpoint POST público — qualquer um consegue chamá-la com qualquer argumento, com ou sem sessão.
// Este teste chama TODAS elas sem sessão (auth() -> null) e falha se alguma gravar no banco, no
// storage de mídia ou chamar a rede. Um handler que valida e autoriza antes de gravar passa sozinho;
// uma action nova que grave antes de autorizar (ou chame store/service direto) quebra aqui.
//
// O banco é um proxy: SELECT devolve vazio, INSERT/UPDATE/DELETE/execute são registrados com o nome
// da tabela. Exceção global: platform.rate_limits (limitar tentativas antes de autenticar é o certo).
// Exceções por action ficam em PUBLIC_ACTIONS, com o motivo.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getTableName, is, Table } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

// Actions públicas por natureza (fluxo de login/cadastro/setup e preferência de UI em cookie).
const PUBLIC_ACTIONS = new Set([
  "app/(auth)/actions.ts#signInWithProviderAction",
  "app/(auth)/actions.ts#signInWithPasswordAction",
  // Cadastro de visitante: grava o usuário quando o autocadastro está ligado — é o propósito.
  "app/(auth)/actions.ts#signUpWithPasswordAction",
  "app/(auth)/actions.ts#signOutAction",
  // Exige SETUP_TOKEN (ausente aqui) — mas a checagem é do próprio fluxo, não de sessão.
  "app/(auth)/actions.ts#bootstrapSuperadminAction",
]);

const ALLOWED_TABLES = new Set(["rate_limits"]);

const recorded: { writes: string[]; storage: string[]; network: string[]; sessionReads: number } = {
  writes: [],
  storage: [],
  network: [],
  sessionReads: 0,
};

type Chain = ((...args: unknown[]) => Chain) & PromiseLike<unknown>;

function chain(result: unknown): Chain {
  const target = function () {} as unknown as Chain;
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
      }
      return () => chain(result);
    },
    apply() {
      return chain(result);
    },
  });
}

function tableLabel(table: unknown): string {
  return is(table, Table) ? getTableName(table as Table) : "?";
}

const fakeDb: Record<string, unknown> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "insert" || prop === "update" || prop === "delete") {
        return (table: unknown) => {
          recorded.writes.push(`${String(prop)}:${tableLabel(table)}`);
          return chain([]);
        };
      }
      if (prop === "execute") {
        return () => {
          recorded.writes.push("execute:raw-sql");
          return chain({ rows: [] });
        };
      }
      if (prop === "transaction") {
        return async (fn: (tx: unknown) => unknown) => fn(fakeDb);
      }
      if (prop === "query") {
        return new Proxy({}, { get: () => new Proxy({}, { get: () => async () => undefined }) });
      }
      return () => chain([]);
    },
  },
);

vi.mock("@/infrastructure/database/client", () => ({ db: fakeDb }));

vi.mock("@/infrastructure/storage", () => ({
  storagePort: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "store" || prop === "remove" || prop === "createUploadTicket") {
          return async () => {
            recorded.storage.push(String(prop));
            return { key: "x", url: "x", size: 0 };
          };
        }
        if (prop === "servesPublicly") return () => true;
        if (prop === "resolveUrl") return (key: string) => `/x/${key}`;
        return async () => null;
      },
    },
  ),
}));

vi.mock("next-auth", () => {
  class AuthError extends Error {}
  class CredentialsSignin extends AuthError {
    code = "credentials";
  }
  return {
    default: () => ({
      handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
      auth: async () => {
        recorded.sessionReads += 1;
        return null;
      },
      signIn: async () => {
        throw new Error("signIn stub");
      },
      signOut: async () => undefined,
    }),
    AuthError,
    CredentialsSignin,
  };
});

// O adapter do Auth.js valida o tipo do db na construção (auth.config.ts, top-level).
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({}) }));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/headers", () => {
  const jar = new Map<string, string>();
  return {
    headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }),
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      has: (name: string) => jar.has(name),
      set: (name: string, value: string) => void jar.set(name, value),
      delete: (name: string) => void jar.delete(name),
    }),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { digest: "NEXT_REDIRECT" });
  },
  permanentRedirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { digest: "NEXT_REDIRECT" });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
  },
  forbidden: () => {
    throw Object.assign(new Error("NEXT_FORBIDDEN"), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  },
  unauthorized: () => {
    throw Object.assign(new Error("NEXT_UNAUTHORIZED"), { digest: "NEXT_HTTP_ERROR_FALLBACK;401" });
  },
}));

function listServerActionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name.startsWith("_fixture")) continue;
      out.push(...listServerActionFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    const head = readFileSync(full, "utf8").trimStart();
    if (head.startsWith('"use server"') || head.startsWith("'use server'")) out.push(full);
  }
  return out;
}

// Preenche os campos mais comuns com valores plausíveis — sem isso muita action pararia na
// validação de input antes de chegar na autorização, e o teste passaria sem testar nada.
function plausibleFormData(): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    id: "00000000-0000-4000-8000-000000000001",
    entryId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    targetUserId: "00000000-0000-4000-8000-000000000002",
    roleId: "00000000-0000-4000-8000-000000000003",
    categoryId: "00000000-0000-4000-8000-000000000004",
    menuId: "00000000-0000-4000-8000-000000000005",
    itemId: "00000000-0000-4000-8000-000000000006",
    assetId: "00000000-0000-4000-8000-000000000007",
    mediaId: "00000000-0000-4000-8000-000000000007",
    revisionId: "00000000-0000-4000-8000-000000000008",
    pluginKey: "academy",
    themeKey: "venore-slime",
    key: "sample-key",
    name: "Nome de teste",
    title: "Título de teste",
    slug: "titulo-de-teste",
    label: "Rótulo",
    description: "Descrição",
    email: "visitante@example.com",
    password: "Senha-de-teste-123",
    newPassword: "Senha-de-teste-456",
    confirmPassword: "Senha-de-teste-456",
    body: "Corpo",
    value: "true",
    enabled: "true",
    visibility: "public",
    status: "published",
    location: "main",
    targetType: "external",
    externalUrl: "https://example.com",
    url: "https://example.com/feed",
    permissionKeys: "cms.entries.manage",
    reason: "motivo",
    tag: "v1.0.0",
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  formData.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "x.png", { type: "image/png" }));
  return formData;
}

const files = listServerActionFiles(SRC_ROOT);
const report: { action: string; writes: string[]; storage: string[]; network: string[] }[] = [];
let checkedActions = 0;
let actionsThatReadSession = 0;

describe("Server Actions sem sessão", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        recorded.network.push(String(input));
        return new Response("{}", { status: 503 });
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("finds the server action files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [path.relative(SRC_ROOT, file), file]))(
    "%s does not write anything for an anonymous caller",
    async (relative, file) => {
      const mod = (await import(file)) as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        if (typeof value !== "function") continue;
        const id = `${relative}#${exportName}`;
        if (PUBLIC_ACTIONS.has(id)) continue;

        recorded.writes = [];
        recorded.storage = [];
        recorded.network = [];
        recorded.sessionReads = 0;

        const formData = plausibleFormData();
        // Assinaturas variam: (formData), (prevState, formData), (id, payload), (input). O mesmo
        // FormData nas duas posições cobre as três primeiras; objeto sem os campos esperados só
        // falha na validação.
        try {
          await (value as (...args: unknown[]) => unknown)(formData, formData);
        } catch {
          // redirect/notFound/erro de validação — o que importa é o que foi gravado antes.
        }

        checkedActions += 1;
        if (recorded.sessionReads > 0) actionsThatReadSession += 1;
        const writes = recorded.writes.filter((write) => !ALLOWED_TABLES.has(write.split(":")[1]));
        report.push({ action: id, writes, storage: [...recorded.storage], network: [...recorded.network] });

        expect({ action: id, writes, storage: recorded.storage, network: recorded.network }).toEqual({
          action: id,
          writes: [],
          storage: [],
          network: [],
        });
      }
    },
  );

  it("actually reached the authorization of most actions (the harness is not vacuous)", () => {
    expect(checkedActions).toBeGreaterThan(30);
    expect(actionsThatReadSession / checkedActions).toBeGreaterThan(0.6);
  });
});
