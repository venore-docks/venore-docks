import type { BlockDefinition } from "@/contexts/cms";
import { NAV_ICON_KEYS } from "@/platform/nav-icons/registry";

export const alertBlockDefinition: BlockDefinition = {
  key: "core.content.alert",
  label: "Aviso",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { title: "Aviso", description: "", variant: "default", icon: "", titleAlign: "start" },
  requiredDataFields: ["title"],
  missingConfigMessage: "Sem título definido",
  editorFields: [
    { name: "title", type: "text", label: "Título" },
    { name: "description", type: "richtext", label: "Descrição" },
    {
      name: "variant",
      type: "select",
      label: "Variante",
      // Só "default"/"destructive" são variantes nativas do Alert do shadcn — warning/success/info
      // são camadas de className por cima (AlertBlockRenderer em block-renderers.tsx), usando
      // tokens de tema (--warning-*, --success-*) ou vocabulário shadcn já existente (info).
      options: [
        { value: "default", label: "Padrão" },
        { value: "destructive", label: "Destrutiva" },
        { value: "warning", label: "Aviso" },
        { value: "success", label: "Sucesso" },
        { value: "info", label: "Informativa" },
      ],
    },
    {
      // Mesma allowlist do resto do app (platform/nav-icons/registry.ts) — reaproveitada, não
      // duplicada.
      name: "icon",
      type: "icon",
      label: "Ícone (opcional)",
      options: [{ value: "", label: "Nenhum" }, ...NAV_ICON_KEYS.map((name) => ({ value: name, label: name }))],
    },
    {
      // No desktop o ícone fica ao lado do título (linha); no mobile fica acima (coluna) — este
      // campo controla o alinhamento do par ícone+título nos dois casos (ver AlertBlockRenderer).
      name: "titleAlign",
      type: "select",
      label: "Alinhamento do título e ícone",
      options: [
        { value: "start", label: "Esquerda" },
        { value: "center", label: "Centro" },
        { value: "end", label: "Direita" },
      ],
    },
  ],
};
