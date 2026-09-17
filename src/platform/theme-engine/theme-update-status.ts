import semver from "semver";
import { authorizeActor } from "@/contexts/rbac";
import type { OperationResult } from "@/shared/types";
import { THEME_REGISTRY } from "@/themes/registry";

export type ThemeUpdateStatus = {
  key: string;
  installedVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  updateAvailable: boolean;
  repo: string;
};

export type GithubThemeRef = { owner: string; repo: string; ref: string };

// Aceita os dois formatos usados nas dependencies do package.json (VENORE-DOCKS.md §5/§6):
// "git+https://github.com/OWNER/REPO.git#vX.Y.Z" e "github:OWNER/REPO#vX.Y.Z".
export function parseGithubThemeRef(spec: string): GithubThemeRef | null {
  const httpsMatch = spec.match(/^git\+https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?#(.+)$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2], ref: httpsMatch[3] };

  const shorthandMatch = spec.match(/^github:([^/]+)\/([^/#]+)#(.+)$/);
  if (shorthandMatch) return { owner: shorthandMatch[1], repo: shorthandMatch[2], ref: shorthandMatch[3] };

  return null;
}

const FETCH_TIMEOUT_MS = 10_000;

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type SitePackageJsonFile = { content: string; sha: string };

// Lê o package.json do CLONE do site (SITE_GITHUB_REPO/SITE_GITHUB_BRANCH) via GitHub Contents
// API — nunca do disco local: em produção (Vercel) o runtime da função serverless não garante o
// package.json do repo, só o que o bundler empacotou. A fonte da verdade sobre "qual tag está
// apontada agora" só existe no GitHub.
export async function fetchSitePackageJson(): Promise<SitePackageJsonFile> {
  const token = process.env.GITHUB_UPDATES_TOKEN;
  const repo = process.env.SITE_GITHUB_REPO;
  if (!token || !repo) {
    throw new Error("GITHUB_UPDATES_TOKEN e SITE_GITHUB_REPO precisam estar configurados.");
  }
  const branch = process.env.SITE_GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/package.json?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!response.ok) {
    throw new Error(`GitHub respondeu ${response.status} ao ler package.json de ${repo}@${branch}.`);
  }
  const payload = (await response.json()) as { content: string; sha: string };
  return { content: Buffer.from(payload.content, "base64").toString("utf-8"), sha: payload.sha };
}

async function fetchLatestTag(
  owner: string,
  repo: string,
  token: string,
): Promise<{ tag: string; version: string } | null> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub respondeu ${response.status} ao listar tags de ${owner}/${repo}.`);
  }
  const tags = (await response.json()) as Array<{ name: string }>;

  const candidates = tags
    .map((tag) => ({ tag: tag.name, version: semver.valid(semver.coerce(tag.name)) }))
    .filter((entry): entry is { tag: string; version: string } => Boolean(entry.version));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => semver.rcompare(a.version, b.version));
  return candidates[0];
}

// Composição do ponto de wiring (mesmo racional de activate-theme.ts): cruza o THEME_REGISTRY
// (versão de código já bundlado) com a tag apontada no package.json do site e a última tag
// publicada no repo do tema, via GitHub API. Não lê nada do disco local — em produção o processo
// serverless não tem garantia do package.json do repo, só o que foi empacotado no build.
export async function getThemeUpdateStatus(themeKey: string): Promise<OperationResult<ThemeUpdateStatus>> {
  const authz = await authorizeActor("platform.extensions.update");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  const entry = THEME_REGISTRY[themeKey];
  if (!entry) {
    return {
      success: false,
      error: { code: "theme-engine.update.unknown_theme", message: `Tema "${themeKey}" não está no registro.` },
    };
  }

  const token = process.env.GITHUB_UPDATES_TOKEN;
  if (!token) {
    return {
      success: false,
      error: {
        code: "theme-engine.update.missing_token",
        message: "GITHUB_UPDATES_TOKEN não configurado — verificação de atualização indisponível.",
      },
    };
  }

  try {
    const pkg = await fetchSitePackageJson();
    const dependencyKey = `@venore/theme-${themeKey}`;
    const dependencySpec = (JSON.parse(pkg.content) as { dependencies?: Record<string, string> }).dependencies?.[
      dependencyKey
    ];
    if (!dependencySpec) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.dependency_not_found",
          message: `${dependencyKey} não está nas dependencies do package.json do site.`,
        },
      };
    }

    const ref = parseGithubThemeRef(dependencySpec);
    if (!ref) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.unpinned_dependency",
          message: `${dependencyKey} não está fixado numa tag git — atualização automática não aplicável.`,
        },
      };
    }

    const latest = await fetchLatestTag(ref.owner, ref.repo, token);
    const installedVersion = entry.manifest.version;
    const installedSemver = semver.valid(semver.coerce(installedVersion)) ?? "0.0.0";
    const updateAvailable = Boolean(latest && semver.gt(latest.version, installedSemver));

    return {
      success: true,
      data: {
        key: themeKey,
        installedVersion,
        latestVersion: latest?.version ?? null,
        latestTag: latest?.tag ?? null,
        updateAvailable,
        repo: `${ref.owner}/${ref.repo}`,
      },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida ao verificar atualização.";
    return { success: false, error: { code: "theme-engine.update.check_failed", message } };
  }
}
