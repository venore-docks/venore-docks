import { authorizeActor } from "@/contexts/rbac";
import type { OperationResult } from "@/shared/types";
import { THEME_REGISTRY } from "@/themes/registry";
import { isReleaseTag, planThemeDependencyUpdate } from "./theme-dependency-update";
import { parseGithubThemeRef } from "./theme-update-status";

const FETCH_TIMEOUT_MS = 10_000;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type ApplyThemeUpdateInput = { themeKey: string; targetTag: string };

type GithubClient = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

function createGithubClient(token: string): GithubClient {
  return async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub respondeu ${response.status} em ${path}: ${text.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  };
}

async function readFileAt(github: GithubClient, repo: string, path: string, ref: string): Promise<string> {
  const payload = await github<{ content: string }>(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
  return Buffer.from(payload.content, "base64").toString("utf-8");
}

// Tag -> commit. Tag anotada aponta pra um objeto "tag" que por sua vez aponta pro commit.
async function resolveTagCommit(github: GithubClient, owner: string, repo: string, tag: string): Promise<string> {
  const ref = await github<{ object: { sha: string; type: string } }>(
    `/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,
  );
  if (ref.object.type === "commit") return ref.object.sha;
  const annotated = await github<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/tags/${ref.object.sha}`);
  return annotated.object.sha;
}

// Dispara a atualização de verdade: comita a nova tag do tema no package.json E no
// package-lock.json do clone do site (branch SITE_GITHUB_BRANCH, ou VERCEL_GIT_COMMIT_REF), num
// ÚNICO commit via Git Data API (árvore nova + fast-forward do branch). O push é o gatilho do
// deploy. A tag precisa existir no repositório do tema — nunca é texto livre do formulário.
export async function applyThemeUpdate(command: ApplyThemeUpdateInput): Promise<OperationResult<void>> {
  const authz = await authorizeActor("platform.extensions.update");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  if (!THEME_REGISTRY[command.themeKey]) {
    return {
      success: false,
      error: { code: "theme-engine.update.unknown_theme", message: `Tema "${command.themeKey}" não está no registro.` },
    };
  }
  if (!isReleaseTag(command.targetTag)) {
    return {
      success: false,
      error: { code: "theme-engine.update.invalid_tag", message: `"${command.targetTag}" não é uma tag de release válida.` },
    };
  }

  const token = process.env.GITHUB_UPDATES_TOKEN;
  const repo = process.env.SITE_GITHUB_REPO;
  if (!token || !repo || !REPO_PATTERN.test(repo)) {
    return {
      success: false,
      error: {
        code: "theme-engine.update.missing_token",
        message: "GITHUB_UPDATES_TOKEN e SITE_GITHUB_REPO (formato dono/repositório) precisam estar configurados.",
      },
    };
  }
  const branch = process.env.SITE_GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";
  const github = createGithubClient(token);
  const dependencyKey = `@venore/theme-${command.themeKey}`;

  try {
    const head = await github<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseCommitSha = head.object.sha;
    const [packageJsonText, packageLockText] = await Promise.all([
      readFileAt(github, repo, "package.json", baseCommitSha),
      readFileAt(github, repo, "package-lock.json", baseCommitSha),
    ]);

    const currentSpec = (JSON.parse(packageJsonText) as { dependencies?: Record<string, string> }).dependencies?.[dependencyKey];
    const themeRef = currentSpec ? parseGithubThemeRef(currentSpec) : null;
    if (!themeRef) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.unpinned_dependency",
          message: `${dependencyKey} não está nas dependencies do site fixado numa tag git.`,
        },
      };
    }

    const commitSha = await resolveTagCommit(github, themeRef.owner, themeRef.repo, command.targetTag);
    const themePackage = JSON.parse(
      await readFileAt(github, `${themeRef.owner}/${themeRef.repo}`, "package.json", commitSha),
    ) as Record<string, unknown>;

    const plan = planThemeDependencyUpdate({
      dependencyKey,
      targetTag: command.targetTag,
      commitSha,
      themePackage,
      packageJsonText,
      packageLockText,
    });
    if (!plan.success) {
      return plan;
    }

    const baseCommit = await github<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${baseCommitSha}`);
    const tree = await github<{ sha: string }>(`/repos/${repo}/git/trees`, {
      method: "POST",
      body: {
        base_tree: baseCommit.tree.sha,
        tree: [
          { path: "package.json", mode: "100644", type: "blob", content: plan.data.packageJson },
          { path: "package-lock.json", mode: "100644", type: "blob", content: plan.data.packageLock },
        ],
      },
    });
    const commit = await github<{ sha: string }>(`/repos/${repo}/git/commits`, {
      method: "POST",
      body: {
        message: `chore(deps): atualiza ${dependencyKey} para ${command.targetTag}`,
        tree: tree.sha,
        parents: [baseCommitSha],
      },
    });
    // force:false = fast-forward only — se o branch andou no meio do caminho, falha em vez de
    // sobrescrever o commit de outra pessoa.
    await github(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: { sha: commit.sha, force: false },
    });

    return { success: true, data: undefined };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida ao aplicar atualização.";
    return { success: false, error: { code: "theme-engine.update.apply_failed", message } };
  }
}
