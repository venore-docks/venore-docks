import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  instancesDir,
  loadInstanceManifest,
  parseInstanceManifest,
  readInstanceName,
  selectInstancePackages,
} from "../../scripts/lib/instance-packages";

const deps = {
  next: "16.0.0",
  "@venore/plugin-sdk": "file:./sdk",
  "@venore/plugin-disc": "github:venore-docks/venore-plugin-disc#v0.2.0",
  "@venore/plugin-vagas": "github:venore-docks/venore-plugin-vagas#v1.2.4",
  "@venore/theme-aurora": "github:venore-docks/venore-theme-aurora#v0.1.13",
  "@venore/theme-academy": "github:venore-docks/venore-theme-academy#v1.1.4",
};

describe("selectInstancePackages (VENORE_INSTANCE)", () => {
  it("sem instância (vanilla): todos os pacotes do tipo, sem o SDK, em ordem alfabética", () => {
    expect(selectInstancePackages("plugin", deps, null)).toEqual(["@venore/plugin-disc", "@venore/plugin-vagas"]);
    expect(selectInstancePackages("theme", deps, null)).toEqual(["@venore/theme-academy", "@venore/theme-aurora"]);
  });

  it("com instância: só o que ela lista", () => {
    const instance = { name: "x", manifest: { plugins: ["vagas"], themes: [] } };
    expect(selectInstancePackages("plugin", deps, instance)).toEqual(["@venore/plugin-vagas"]);
    expect(selectInstancePackages("theme", deps, instance)).toEqual([]);
  });

  it("pacote listado que não está no package.json é erro", () => {
    const instance = { name: "x", manifest: { plugins: ["broadcast"], themes: [] } };
    expect(() => selectInstancePackages("plugin", deps, instance)).toThrow(/@venore\/plugin-broadcast/);
  });
});

describe("readInstanceName / parseInstanceManifest", () => {
  it("vazio ou só espaço = vanilla", () => {
    expect(readInstanceName({})).toBeNull();
    expect(readInstanceName({ VENORE_INSTANCE: "  " })).toBeNull();
    expect(readInstanceName({ VENORE_INSTANCE: " nestpro " })).toBe("nestpro");
  });

  it("rejeita nome de pacote completo e formato errado", () => {
    expect(() => parseInstanceManifest("x", { plugins: ["@venore/plugin-disc"] })).toThrow(/plugins/);
    expect(() => parseInstanceManifest("x", [])).toThrow(/objeto/);
    expect(parseInstanceManifest("x", { themes: ["aurora"] })).toEqual({ plugins: [], themes: ["aurora"] });
  });

  it("instância inexistente ou com nome inválido é erro", () => {
    expect(() => loadInstanceManifest(process.cwd(), "nao-existe")).toThrow(/não existe/);
    expect(() => loadInstanceManifest(process.cwd(), "../package")).toThrow(/inválido/);
  });
});

// Toda instância declarada no repositório precisa casar com o package.json atual — tirar um pacote
// do package.json sem tirar da instância quebraria o build só daquele projeto na Vercel.
describe("instances/*.json do repositório", () => {
  const root = process.cwd();
  const hostDeps = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8")) as { dependencies: Record<string, string> })
    .dependencies;
  const names = readdirSync(instancesDir(root))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length));

  it.each(names)("%s só lista pacotes do package.json", (name) => {
    const instance = { name, manifest: loadInstanceManifest(root, name) };
    expect(() => selectInstancePackages("plugin", hostDeps, instance)).not.toThrow();
    expect(() => selectInstancePackages("theme", hostDeps, instance)).not.toThrow();
  });
});
