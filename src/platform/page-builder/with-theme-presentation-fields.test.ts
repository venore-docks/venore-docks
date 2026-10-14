import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@/contexts/cms/contracts/block-definition";
import { SECTION_BLOCK_KEY } from "./blocks/section";
import {
  availableSectionStyles,
  resolveSectionStyle,
  withThemePresentationFields,
  withUnavailableOption,
} from "./with-theme-presentation-fields";

const hero: BlockDefinition = {
  key: "core.content.hero",
  label: "Hero",
  category: "conteudo",
  structure: "leaf",
  defaultData: { title: "" },
  editorFields: [{ name: "title", type: "text", label: "Título" }],
  allowedInRoot: true,
};
const section: BlockDefinition = {
  key: SECTION_BLOCK_KEY,
  label: "Seção",
  category: "estrutura",
  structure: "areas",
  defaultData: {},
  editorFields: [{ name: "background", type: "select", label: "Fundo", options: [{ value: "none", label: "Nenhum" }] }],
  allowedInRoot: true,
  areaDefinitions: [{ key: "content", label: "Conteúdo", allowedBlockKeys: ["core.content.hero"] }],
};
const none = { blockVariants: {}, sectionStyles: [], hideSectionStyles: [] };
const themed = {
  blockVariants: { "core.content.hero": [{ value: "poster", label: { messageKey: "hero.poster" } }, { value: "default", label: "x" }] },
  sectionStyles: [{ value: "glass", label: "Vidro" }],
  hideSectionStyles: ["accent" as const, "default" as const],
};

describe("withThemePresentationFields", () => {
  it("devolve CÓPIAS — o registro do core nunca é mutado (dois temas no mesmo processo)", () => {
    const input = [hero, section];
    const snapshot = JSON.stringify(input);
    const a = withThemePresentationFields(input, themed, (text) => (typeof text === "string" ? text : `t:${text.messageKey}`));
    const b = withThemePresentationFields(input, none);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(a[0]).not.toBe(hero);
    expect(a[0].editorFields).not.toBe(hero.editorFields);
    expect(a[1].areaDefinitions![0].allowedBlockKeys).not.toBe(section.areaDefinitions![0].allowedBlockKeys);
    expect(a[0].editorFields.map((field) => field.name)).toEqual(["title", "presentationVariant"]);
    expect(b[0].editorFields.map((field) => field.name)).toEqual(["title"]);
  });

  it("'Aparência' lista as variantes do tema (rótulo resolvido) com 'Padrão' primeiro", () => {
    const [themedHero] = withThemePresentationFields([hero], themed, (text) => (typeof text === "string" ? text : `t:${text.messageKey}`));
    const field = themedHero.editorFields.find((candidate) => candidate.name === "presentationVariant");
    expect(field).toMatchObject({ type: "select", label: "Aparência" });
    expect(field!.options).toEqual([
      { value: "default", label: "Padrão" },
      { value: "poster", label: "t:hero.poster" },
    ]);
  });

  it("'Estilo da seção' = canônicos − escondidos + extras do tema", () => {
    const [, themedSection] = withThemePresentationFields([hero, section], themed);
    const field = themedSection.editorFields.find((candidate) => candidate.name === "sectionStyle");
    expect(field!.options!.map((option) => option.value)).toEqual(["default", "muted", "brand", "inverted", "glass"]);
    expect(field!.options!.at(-1)).toEqual({ value: "glass", label: "Vidro" });
    const [, plain] = withThemePresentationFields([hero, section], none);
    expect(plain.editorFields.find((candidate) => candidate.name === "sectionStyle")!.options!.map((option) => option.value)).toEqual([
      "default",
      "muted",
      "brand",
      "inverted",
      "accent",
    ]);
  });
});

describe("estilos de seção", () => {
  it("valor desconhecido/escondido/ausente cai em default", () => {
    expect(availableSectionStyles(themed)).toEqual(["default", "muted", "brand", "inverted", "glass"]);
    expect(resolveSectionStyle("glass", themed)).toBe("glass");
    expect(resolveSectionStyle("accent", themed)).toBe("default");
    expect(resolveSectionStyle("neon", themed)).toBe("default");
    expect(resolveSectionStyle(undefined, themed)).toBe("default");
    expect(resolveSectionStyle("glass", none)).toBe("default");
  });
});

describe("withUnavailableOption", () => {
  it("valor guardado que o tema não oferece aparece rotulado, sem sumir", () => {
    const options = [{ value: "default", label: "Padrão" }];
    expect(withUnavailableOption(options, "poster")).toEqual([...options, { value: "poster", label: "poster (indisponível neste tema)" }]);
    expect(withUnavailableOption(options, "default")).toEqual(options);
    expect(withUnavailableOption(options, "")).toEqual(options);
  });
});
