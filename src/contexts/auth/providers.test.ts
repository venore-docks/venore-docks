import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "GITHUB_ID",
  "GITHUB_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "GOOGLE_ID",
  "GOOGLE_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "MICROSOFT_ID",
  "MICROSOFT_SECRET",
  "MICROSOFT_ISSUER",
  "AUTH_CREDENTIALS_USERNAME",
  "AUTH_CREDENTIALS_PASSWORD",
  "AUTH_LOGIN_USERNAME",
  "AUTH_LOGIN_PASSWORD",
  "AUTH_ENABLE_DEV_CREDENTIALS",
  "AUTH_DISABLE_CREDENTIALS",
  "AUTH_ENABLE_CREDENTIALS",
];

function clearAuthEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("providers env helpers", () => {
  beforeEach(() => {
    clearAuthEnv();
  });

  afterEach(() => {
    clearAuthEnv();
  });

  it("hasRequiredProviderEnv returns true only when all keys are present", async () => {
    const { hasRequiredProviderEnv } = await import("./providers");

    expect(hasRequiredProviderEnv(["GOOGLE_ID", "GOOGLE_SECRET"])).toBe(false);

    process.env.GOOGLE_ID = "id";
    expect(hasRequiredProviderEnv(["GOOGLE_ID", "GOOGLE_SECRET"])).toBe(false);

    process.env.GOOGLE_SECRET = "secret";
    expect(hasRequiredProviderEnv(["GOOGLE_ID", "GOOGLE_SECRET"])).toBe(true);
  });

  it("hasRequiredProviderEnv treats empty/whitespace values as absent", async () => {
    const { hasRequiredProviderEnv } = await import("./providers");

    process.env.GOOGLE_ID = "   ";
    process.env.GOOGLE_SECRET = "secret";
    expect(hasRequiredProviderEnv(["GOOGLE_ID", "GOOGLE_SECRET"])).toBe(false);
  });

  it("hasRequiredProviderEnv strips accidental surrounding quotes", async () => {
    const { readEnvValue } = await import("./providers");

    process.env.GOOGLE_ID = "\"abc123\"";
    expect(readEnvValue("GOOGLE_ID")).toBe("abc123");

    process.env.GOOGLE_SECRET = "'xyz'";
    expect(readEnvValue("GOOGLE_SECRET")).toBe("xyz");
  });

  it("hasRequiredProviderEnvAliases passes when at least one alias per group is present", async () => {
    const { hasRequiredProviderEnvAliases } = await import("./providers");

    expect(
      hasRequiredProviderEnvAliases([
        ["GITHUB_ID", "AUTH_GITHUB_ID"],
        ["GITHUB_SECRET", "AUTH_GITHUB_SECRET"],
      ]),
    ).toBe(false);

    process.env.AUTH_GITHUB_ID = "id";
    process.env.GITHUB_SECRET = "secret";
    expect(
      hasRequiredProviderEnvAliases([
        ["GITHUB_ID", "AUTH_GITHUB_ID"],
        ["GITHUB_SECRET", "AUTH_GITHUB_SECRET"],
      ]),
    ).toBe(true);
  });

  it("isCredentialsDisabled requires the exact flag value \"true\"", async () => {
    const { isCredentialsDisabled } = await import("./providers");

    expect(isCredentialsDisabled()).toBe(false);

    process.env.AUTH_DISABLE_CREDENTIALS = "1";
    expect(isCredentialsDisabled()).toBe(false);

    process.env.AUTH_DISABLE_CREDENTIALS = "yes";
    expect(isCredentialsDisabled()).toBe(false);

    process.env.AUTH_DISABLE_CREDENTIALS = '"true"';
    expect(isCredentialsDisabled()).toBe(true);
  });

  it("isCredentialsExplicitlyEnabled requires the exact flag value \"true\"", async () => {
    const { isCredentialsExplicitlyEnabled } = await import("./providers");

    expect(isCredentialsExplicitlyEnabled()).toBe(false);

    process.env.AUTH_ENABLE_CREDENTIALS = "1";
    expect(isCredentialsExplicitlyEnabled()).toBe(false);

    process.env.AUTH_ENABLE_CREDENTIALS = '"true"';
    expect(isCredentialsExplicitlyEnabled()).toBe(true);
  });

  it("isCredentialsEnabled: opt-in flag, or safety net when no OAuth is configured", async () => {
    const { isCredentialsEnabled } = await import("./providers");

    // rede de segurança: sem OAuth -> ligado
    expect(isCredentialsEnabled(0)).toBe(true);
    // com OAuth e sem flag -> desligado (mesmo esquema do OAuth: precisa opt-in)
    expect(isCredentialsEnabled(1)).toBe(false);

    process.env.AUTH_ENABLE_CREDENTIALS = "true";
    expect(isCredentialsEnabled(1)).toBe(true);
    expect(isCredentialsEnabled(0)).toBe(true);

    // kill-switch sempre vence
    process.env.AUTH_DISABLE_CREDENTIALS = "true";
    expect(isCredentialsEnabled(0)).toBe(false);
    expect(isCredentialsEnabled(1)).toBe(false);
  });
});

describe("buildAuthProviders", () => {
  beforeEach(() => {
    clearAuthEnv();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    clearAuthEnv();
    vi.restoreAllMocks();
  });

  it("rede de segurança: sem nenhum provider configurado, o Credentials liga sozinho (e avisa)", async () => {
    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["credentials"]);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("com OAuth configurado e sem AUTH_ENABLE_CREDENTIALS, o Credentials NÃO entra", async () => {
    process.env.GOOGLE_ID = "id";
    process.env.GOOGLE_SECRET = "secret";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["google"]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("AUTH_ENABLE_CREDENTIALS=\"true\" liga o Credentials junto com o OAuth (sem aviso)", async () => {
    process.env.GOOGLE_ID = "id";
    process.env.GOOGLE_SECRET = "secret";
    process.env.AUTH_ENABLE_CREDENTIALS = "true";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["google", "credentials"]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("AUTH_ENABLE_CREDENTIALS que não é exatamente \"true\" não liga (com OAuth presente)", async () => {
    process.env.GOOGLE_ID = "id";
    process.env.GOOGLE_SECRET = "secret";
    process.env.AUTH_ENABLE_CREDENTIALS = "1";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["google"]);
  });

  it("supports the AUTH_ prefixed Google alias", async () => {
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["google"]);
  });

  it("builds github, google and microsoft together; Credentials só com AUTH_ENABLE_CREDENTIALS", async () => {
    process.env.GITHUB_ID = "gh-id";
    process.env.GITHUB_SECRET = "gh-secret";
    process.env.GOOGLE_ID = "g-id";
    process.env.GOOGLE_SECRET = "g-secret";
    process.env.MICROSOFT_ID = "m-id";
    process.env.MICROSOFT_SECRET = "m-secret";
    process.env.MICROSOFT_ISSUER = "m-issuer";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((p) => p.id)).toEqual(["github", "google", "microsoft-entra-id"]);

    process.env.AUTH_ENABLE_CREDENTIALS = "true";
    expect(buildAuthProviders().map((p) => p.id)).toEqual(["github", "google", "microsoft-entra-id", "credentials"]);
  });

  it("omits microsoft when the issuer is missing (e cai na rede de segurança)", async () => {
    process.env.MICROSOFT_ID = "m-id";
    process.env.MICROSOFT_SECRET = "m-secret";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["credentials"]);
  });

  it("omits the credentials provider when AUTH_DISABLE_CREDENTIALS is \"true\" (mesmo com AUTH_ENABLE_CREDENTIALS)", async () => {
    process.env.AUTH_ENABLE_CREDENTIALS = "true";
    process.env.AUTH_DISABLE_CREDENTIALS = "true";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders()).toEqual([]);
  });

  it("keeps OAuth providers but drops credentials when AUTH_DISABLE_CREDENTIALS wins", async () => {
    process.env.GOOGLE_ID = "id";
    process.env.GOOGLE_SECRET = "secret";
    process.env.AUTH_ENABLE_CREDENTIALS = "true";
    process.env.AUTH_DISABLE_CREDENTIALS = "true";

    const { buildAuthProviders } = await import("./providers");
    expect(buildAuthProviders().map((provider) => provider.id)).toEqual(["google"]);
  });
});

describe("listAvailableAuthProviders", () => {
  beforeEach(() => {
    clearAuthEnv();
  });

  afterEach(() => {
    clearAuthEnv();
  });

  it("reports every provider as disabled when no env vars are set", async () => {
    const { listAvailableAuthProviders } = await import("./providers");

    expect(listAvailableAuthProviders()).toEqual([
      { key: "github", label: "GitHub", kind: "oauth", enabled: false },
      { key: "google", label: "Google", kind: "oauth", enabled: false, iconUrl: "/providers/google.svg" },
      {
        key: "microsoft-entra-id",
        label: "Microsoft",
        kind: "oauth",
        enabled: false,
        iconUrl: "/providers/microsoft.svg",
      },
      { key: "credentials", label: "Senha", kind: "password", enabled: true },
    ]);
  });

  it("com OAuth configurado e sem AUTH_ENABLE_CREDENTIALS, marca credentials como disabled", async () => {
    process.env.GITHUB_ID = "gh-id";
    process.env.GITHUB_SECRET = "gh-secret";

    const { listAvailableAuthProviders } = await import("./providers");
    const descriptors = listAvailableAuthProviders();

    expect(descriptors.find((d) => d.key === "github")?.enabled).toBe(true);
    expect(descriptors.find((d) => d.key === "google")?.enabled).toBe(false);
    expect(descriptors.find((d) => d.key === "credentials")?.enabled).toBe(false);
  });

  it("reflects the same detection state as buildAuthProviders com AUTH_ENABLE_CREDENTIALS", async () => {
    process.env.GITHUB_ID = "gh-id";
    process.env.GITHUB_SECRET = "gh-secret";
    process.env.AUTH_ENABLE_CREDENTIALS = "true";

    const { listAvailableAuthProviders } = await import("./providers");
    const descriptors = listAvailableAuthProviders();

    expect(descriptors.find((d) => d.key === "github")?.enabled).toBe(true);
    expect(descriptors.find((d) => d.key === "google")?.enabled).toBe(false);
    expect(descriptors.find((d) => d.key === "microsoft-entra-id")?.enabled).toBe(false);
    expect(descriptors.find((d) => d.key === "credentials")?.enabled).toBe(true);
  });

  it("marks credentials as disabled when AUTH_DISABLE_CREDENTIALS is \"true\"", async () => {
    process.env.AUTH_DISABLE_CREDENTIALS = "true";

    const { listAvailableAuthProviders } = await import("./providers");
    expect(listAvailableAuthProviders().find((d) => d.key === "credentials")?.enabled).toBe(false);
  });
});
