import type { BlockDefinition } from "@/contexts/cms";

export const codeBlockDefinition: BlockDefinition = {
  key: "core.content.code",
  label: "Código",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { code: "", language: "", caption: "" },
  requiredDataFields: ["code"],
  missingConfigMessage: "Nenhum código",
  editorFields: [
    { name: "code", type: "textarea", label: "Código" },
    { name: "language", type: "text", label: "Linguagem (ex: ts, bash) — rótulo" },
    { name: "caption", type: "text", label: "Legenda (opcional)" },
  ],
};
