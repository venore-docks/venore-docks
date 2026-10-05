// Seleção de instância: quais pacotes @venore/plugin-* e @venore/theme-* do package.json entram
// no build. Um branch só (`main`) serve todas as instâncias; o package.json declara a UNIÃO dos
// pacotes (uma versão por pacote, para todas as instâncias) e cada instância escolhe um
// subconjunto em `instances/<nome>.json`, apontado pela env `VENORE_INSTANCE` do projeto na Vercel.
//
//   VENORE_INSTANCE vazio/ausente -> "venore vanilla": todos os pacotes do package.json.
//   VENORE_INSTANCE=<nome>        -> só os pacotes listados em instances/<nome>.json.
//
// Instância desconhecida, arquivo inválido ou pacote listado que não está no package.json é
// sempre erro (mesmo sem --strict): um deploy com a instância errada não pode subir em silêncio
// com o conjunto de plugins de outra.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export type InstancePackageKind = "plugin" | "theme";

export type InstanceManifest = { plugins: string[]; themes: string[] };

const INSTANCE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SDK_PACKAGES = new Set(["@venore/plugin-sdk", "@venore/theme-sdk"]);

function prefixFor(kind: InstancePackageKind): string {
  return kind === "plugin" ? "@venore/plugin-" : "@venore/theme-";
}

export function instancesDir(root: string): string {
  return path.join(root, "instances");
}

export function readInstanceName(env: Record<string, string | undefined> = process.env): string | null {
  const name = env.VENORE_INSTANCE?.trim();
  return name ? name : null;
}

export function parseInstanceManifest(name: string, raw: unknown): InstanceManifest {
  const fail = (detail: string): never => {
    throw new Error(`instances/${name}.json inválido: ${detail}`);
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("esperado um objeto { plugins, themes }.");
  const record = raw as Record<string, unknown>;
  const list = (field: "plugins" | "themes"): string[] => {
    const value = record[field] ?? [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !INSTANCE_NAME_PATTERN.test(item))) {
      fail(`"${field}" precisa ser uma lista de chaves (ex: "disc", não "@venore/plugin-disc").`);
    }
    return value as string[];
  };
  return { plugins: list("plugins"), themes: list("themes") };
}

export function loadInstanceManifest(root: string, name: string): InstanceManifest {
  if (!INSTANCE_NAME_PATTERN.test(name)) {
    throw new Error(`VENORE_INSTANCE="${name}" inválido — use o nome de um arquivo de instances/ (ex: "nestpro").`);
  }
  const file = path.join(instancesDir(root), `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(`VENORE_INSTANCE="${name}", mas instances/${name}.json não existe.`);
  }
  return parseInstanceManifest(name, JSON.parse(readFileSync(file, "utf-8")));
}

// Pacotes @venore/<kind>-* declarados no package.json, filtrados pela instância. Ordem estável
// (alfabética) para o codegen não gerar diff só por ordem de chave.
export function selectInstancePackages(
  kind: InstancePackageKind,
  dependencies: Record<string, string>,
  instance: { name: string; manifest: InstanceManifest } | null,
): string[] {
  const prefix = prefixFor(kind);
  const declared = Object.keys(dependencies)
    .filter((dep) => dep.startsWith(prefix) && !SDK_PACKAGES.has(dep))
    .sort();
  if (!instance) return declared;

  const wanted = (kind === "plugin" ? instance.manifest.plugins : instance.manifest.themes).map((key) => prefix + key);
  const missing = wanted.filter((dep) => !declared.includes(dep));
  if (missing.length > 0) {
    throw new Error(
      `instances/${instance.name}.json lista ${missing.join(", ")}, que não está nas dependencies do package.json. ` +
        `Adicione o pacote ao package.json (versão única para todas as instâncias) ou tire-o da instância.`,
    );
  }
  return declared.filter((dep) => wanted.includes(dep));
}

// `.env` local só para quem roda o codegen fora da Vercel (npm install/dev); env real tem
// precedência, como no --env-file do Node.
function readDotEnv(root: string): Record<string, string | undefined> {
  const file = path.join(root, ".env");
  return existsSync(file) ? parseEnv(readFileSync(file, "utf-8")) : {};
}

// Atalho para os scripts de codegen: lê env + package.json do host e devolve a seleção.
export function resolveInstancePackages(root: string, kind: InstancePackageKind): { instance: string; packages: string[] } {
  const hostPkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const name = readInstanceName({ ...readDotEnv(root), ...process.env });
  const instance = name ? { name, manifest: loadInstanceManifest(root, name) } : null;
  return { instance: name ?? "vanilla", packages: selectInstancePackages(kind, hostPkg.dependencies ?? {}, instance) };
}
