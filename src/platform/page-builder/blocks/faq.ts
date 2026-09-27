import type { BlockDefinition } from "@/contexts/cms";

// Perguntas frequentes: acordeão + JSON-LD FAQPage (resultado rico no Google).
export const faqBlockDefinition: BlockDefinition = {
  key: "core.content.faq",
  label: "Perguntas frequentes",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { items: "Qual é a pergunta?\nEsta é a resposta.", title: "" },
  requiredDataFields: ["items"],
  missingConfigMessage: "Nenhuma pergunta cadastrada",
  editorFields: [
    { name: "title", type: "text", label: "Título (opcional)" },
    {
      name: "items",
      type: "textarea",
      label: "Perguntas (primeira linha = pergunta, linhas seguintes = resposta; linha em branco separa)",
    },
  ],
};
