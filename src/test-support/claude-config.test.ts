import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Prova executável de AGENTS.md §9 (economia de tokens). O AGENTS.md entra inteiro no contexto de
// toda sessão do Claude; o detalhe por área mora em .claude/rules/*.md, que só carrega quando um
// arquivo casado pelo `paths:` é lido ou editado. Se o YAML de uma regra quebrar, o Claude Code
// ignora o `paths:` e a regra passa a carregar sempre — por isso o parse é conferido aqui.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const AGENTS_MD_MAX_BYTES = 20_000;

function read(relative: string): string {
  return readFileSync(`${ROOT}${relative}`, "utf8");
}

function frontmatter(source: string): string[] | null {
  const lines = source.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  return end === -1 ? null : lines.slice(1, end);
}

function field(lines: string[], key: string): string | undefined {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim();
}

// Parte do glob antes do primeiro caractere especial — tem que existir no repositório, senão a
// regra nunca carrega (typo de caminho).
function staticPrefix(glob: string): string {
  const cut = glob.search(/[*?[{]/);
  const prefix = cut === -1 ? glob : glob.slice(0, cut);
  return prefix.endsWith("/") || cut === -1 ? prefix : prefix.slice(0, prefix.lastIndexOf("/") + 1);
}

const ruleFiles = readdirSync(`${ROOT}.claude/rules`).filter((name) => name.endsWith(".md"));

describe("AGENTS.md", () => {
  it(`cabe no orçamento de ${AGENTS_MD_MAX_BYTES} bytes (detalhe novo vai para .claude/rules/)`, () => {
    expect(Buffer.byteLength(read("AGENTS.md"))).toBeLessThanOrEqual(AGENTS_MD_MAX_BYTES);
  });

  it("só aponta para regras que existem", () => {
    const referenced = [...read("AGENTS.md").matchAll(/\.claude\/rules\/([\w-]+\.md)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) expect(ruleFiles).toContain(name);
  });
});

describe.each(ruleFiles)(".claude/rules/%s", (name) => {
  const lines = frontmatter(read(`.claude/rules/${name}`));

  it("tem frontmatter só com `paths:` e uma lista de globs entre aspas", () => {
    expect(lines).not.toBeNull();
    expect(lines?.[0]).toBe("paths:");
    const items = lines?.slice(1) ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item).toMatch(/^ {2}- "[^"]+"$/);
  });

  it("cada glob começa por um caminho que existe", () => {
    const globs = (lines?.slice(1) ?? []).map((item) => item.replace(/^ {2}- "|"$/g, ""));
    for (const glob of globs) {
      const prefix = staticPrefix(glob);
      expect(existsSync(`${ROOT}${prefix}`), `${glob} → ${prefix}`).toBe(true);
    }
  });
});

describe.each(readdirSync(`${ROOT}.claude/skills`))(".claude/skills/%s", (dir) => {
  it("tem SKILL.md com name igual à pasta e description", () => {
    const lines = frontmatter(read(`.claude/skills/${dir}/SKILL.md`));
    expect(lines).not.toBeNull();
    expect(field(lines ?? [], "name")).toBe(dir);
    expect(field(lines ?? [], "description")?.length).toBeGreaterThan(20);
  });
});

describe.each(readdirSync(`${ROOT}.claude/agents`))(".claude/agents/%s", (file) => {
  it("tem name igual ao arquivo, description e model", () => {
    const lines = frontmatter(read(`.claude/agents/${file}`));
    expect(lines).not.toBeNull();
    expect(field(lines ?? [], "name")).toBe(file.replace(/\.md$/, ""));
    expect(field(lines ?? [], "description")?.length).toBeGreaterThan(20);
    expect(field(lines ?? [], "model")).toMatch(/^(haiku|sonnet|opus|inherit)$/);
  });
});

describe(".claude/settings.json", () => {
  it("é JSON válido e compacta o contexto antes de 1 milhão de tokens", () => {
    const settings = JSON.parse(read(".claude/settings.json")) as { autoCompactWindow?: number };
    expect(settings.autoCompactWindow).toBeGreaterThanOrEqual(100_000);
    expect(settings.autoCompactWindow).toBeLessThanOrEqual(300_000);
  });
});
