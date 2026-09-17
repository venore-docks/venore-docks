import { authorizeActor } from "@/contexts/rbac";
import type { OperationResult } from "@/shared/types";
import { THEME_REGISTRY } from "@/themes/registry";
import { fetchSitePackageJson, parseGithubThemeRef } from "./theme-update-status";

const FETCH_TIMEOUT_MS = 10_000;

export type ApplyThemeUpdateInput = { themeKey: string; targetTag: string };

// Dispara a atualização de verdade: comita a nova tag do tema direto no package.json do clone do
// site (branch SITE_GITHUB_BRANCH, ou VERCEL_GIT_COMMIT_REF em produção). O push É o gatilho — a
// Vercel já está plugada no repo via integração git e builda/deploya sozinha a partir daí.
//
// Não espera o deploy terminar (leva alguns minutos, roda fora deste request/response): o
// THEME_REGISTRY só vai refletir a versão nova depois do próximo build. targetTag vem do mesmo
// check feito por getThemeUpdateStatus — evita reconsultar o GitHub e garante que o botão
// "Atualizar" aplica exatamente a versão que a tela mostrou.
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

  const token = process.env.GITHUB_UPDATES_TOKEN;
  const repo = process.env.SITE_GITHUB_REPO;
  if (!token || !repo) {
    return {
      success: false,
      error: {
        code: "theme-engine.update.missing_token",
        message: "GITHUB_UPDATES_TOKEN e SITE_GITHUB_REPO precisam estar configurados.",
      },
    };
  }
  const branch = process.env.SITE_GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";

  try {
    const pkg = await fetchSitePackageJson();
    const dependencyKey = `@venore/theme-${command.themeKey}`;
    const parsed = JSON.parse(pkg.content) as { dependencies?: Record<string, string> };
    const currentSpec = parsed.dependencies?.[dependencyKey];
    if (!currentSpec) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.dependency_not_found",
          message: `${dependencyKey} não está nas dependencies do package.json do site.`,
        },
      };
    }

    const ref = parseGithubThemeRef(currentSpec);
    if (!ref) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.unpinned_dependency",
          message: `${dependencyKey} não está fixado numa tag git.`,
        },
      };
    }

    const newSpec = currentSpec.replace(`#${ref.ref}`, `#${command.targetTag}`);
    const needle = `"${dependencyKey}": "${currentSpec}"`;
    const newContent = pkg.content.replace(needle, `"${dependencyKey}": "${newSpec}"`);
    if (!pkg.content.includes(needle) || newContent === pkg.content) {
      return {
        success: false,
        error: {
          code: "theme-engine.update.rewrite_failed",
          message: "Não foi possível localizar a linha da dependência no package.json para atualizar.",
        },
      };
    }

    const response = await fetch(`https://api.github.com/repos/${repo}/contents/package.json`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        message: `chore: atualiza ${dependencyKey} para ${command.targetTag}`,
        content: Buffer.from(newContent, "utf-8").toString("base64"),
        sha: pkg.sha,
        branch,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub respondeu ${response.status} ao commitar package.json: ${body.slice(0, 200)}`);
    }

    return { success: true, data: undefined };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida ao aplicar atualização.";
    return { success: false, error: { code: "theme-engine.update.apply_failed", message } };
  }
}
