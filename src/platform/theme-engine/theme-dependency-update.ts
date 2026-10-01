import type { OperationResult } from "@/shared/types";
import { parseGithubThemeRef } from "./theme-update-status";

// Só tags de release semver (v1.2.3, 1.2.3, v1.2.3-rc.1). Tudo o que vai virar texto dentro do
// package.json passa por aqui primeiro — a tag chegava crua do formulário e era concatenada no
// arquivo (uma tag com `"` injetava dependências arbitrárias no build).
const RELEASE_TAG_PATTERN = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export function isReleaseTag(tag: string): boolean {
  return RELEASE_TAG_PATTERN.test(tag);
}

export type ThemeDependencyUpdateInput = {
  dependencyKey: string;
  targetTag: string;
  // Commit que a tag aponta no repositório do tema (resolvido via GitHub API, nunca do cliente).
  commitSha: string;
  // package.json do tema NA tag — versão e peerDependencies vão pro lockfile.
  themePackage: { version?: unknown; dependencies?: unknown; peerDependencies?: unknown };
  packageJsonText: string;
  packageLockText: string;
};

export type ThemeDependencyUpdatePlan = { packageJson: string; packageLock: string; newSpec: string };

type LockPackage = Record<string, unknown> & { resolved?: string; version?: string };
type LockFile = { packages?: Record<string, LockPackage> & { ""?: { dependencies?: Record<string, string> } } };

function fail(code: string, message: string): OperationResult<ThemeDependencyUpdatePlan> {
  return { success: false, error: { code: `theme-engine.update.${code}`, message } };
}

// Calcula o novo package.json + package-lock.json de uma troca de tag de tema, estruturadamente
// (JSON.parse/stringify, nunca replace de texto). Atualizar os dois juntos mantém `npm ci`
// funcionando e o build reprodutível — antes só o package.json mudava e o lock divergia.
export function planThemeDependencyUpdate(input: ThemeDependencyUpdateInput): OperationResult<ThemeDependencyUpdatePlan> {
  if (!isReleaseTag(input.targetTag)) {
    return fail("invalid_tag", `"${input.targetTag}" não é uma tag de release válida (ex: v1.2.3).`);
  }
  if (!COMMIT_SHA_PATTERN.test(input.commitSha)) {
    return fail("invalid_commit", "A tag não resolveu para um commit válido.");
  }
  if (typeof input.themePackage.version !== "string") {
    return fail("invalid_theme_package", "O package.json do tema na tag não declara `version`.");
  }
  const themeDeps = input.themePackage.dependencies;
  if (themeDeps && typeof themeDeps === "object" && Object.keys(themeDeps).length > 0) {
    // O lockfile precisaria das dependências transitivas novas — isso só `npm install` resolve.
    return fail(
      "theme_has_dependencies",
      "Esta versão do tema traz dependências próprias; atualize com `npm install` localmente e faça o commit do lockfile.",
    );
  }

  let packageJson: { dependencies?: Record<string, string> };
  let packageLock: LockFile;
  try {
    packageJson = JSON.parse(input.packageJsonText);
    packageLock = JSON.parse(input.packageLockText);
  } catch {
    return fail("invalid_json", "package.json ou package-lock.json do site não é JSON válido.");
  }

  const currentSpec = packageJson.dependencies?.[input.dependencyKey];
  if (!currentSpec) {
    return fail("dependency_not_found", `${input.dependencyKey} não está nas dependencies do package.json do site.`);
  }
  const ref = parseGithubThemeRef(currentSpec);
  if (!ref) {
    return fail("unpinned_dependency", `${input.dependencyKey} não está fixado numa tag git.`);
  }
  const newSpec = `${currentSpec.slice(0, currentSpec.length - ref.ref.length)}${input.targetTag}`;

  const lockEntry = packageLock.packages?.[`node_modules/${input.dependencyKey}`];
  const rootEntry = packageLock.packages?.[""];
  if (!lockEntry || typeof lockEntry.resolved !== "string" || !rootEntry?.dependencies) {
    return fail("lock_entry_not_found", `${input.dependencyKey} não está no package-lock.json do site.`);
  }
  const hashIndex = lockEntry.resolved.lastIndexOf("#");
  if (hashIndex === -1) {
    return fail("lock_entry_not_git", `${input.dependencyKey} no lockfile não aponta pra um commit git.`);
  }

  packageJson.dependencies = { ...packageJson.dependencies, [input.dependencyKey]: newSpec };
  rootEntry.dependencies[input.dependencyKey] = newSpec;
  lockEntry.resolved = `${lockEntry.resolved.slice(0, hashIndex + 1)}${input.commitSha}`;
  lockEntry.version = input.themePackage.version;
  if (input.themePackage.peerDependencies && typeof input.themePackage.peerDependencies === "object") {
    lockEntry.peerDependencies = input.themePackage.peerDependencies;
  } else {
    delete lockEntry.peerDependencies;
  }

  return {
    success: true,
    data: {
      // Mesmo formato que o npm grava (2 espaços + \n final) — diff mínimo no commit.
      packageJson: `${JSON.stringify(packageJson, null, 2)}\n`,
      packageLock: `${JSON.stringify(packageLock, null, 2)}\n`,
      newSpec,
    },
  };
}
