import type { BlockDefinition } from "@/contexts/cms";
import { NAV_ICON_KEYS } from "@/platform/nav-icons/registry";

export const iconBlockDefinition: BlockDefinition = {
  key: "core.content.icon",
  label: "Ícone",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { name: "star", size: "md", tone: "foreground" },
  editorFields: [
    {
      name: "name",
      type: "icon",
      label: "Ícone",
      options: NAV_ICON_KEYS.map((name) => ({ value: name, label: name })),
    },
    {
      name: "size",
      type: "select",
      label: "Tamanho",
      options: [
        { value: "sm", label: "Pequeno" },
        { value: "md", label: "Médio" },
        { value: "lg", label: "Grande" },
      ],
    },
    {
      name: "tone",
      type: "select",
      label: "Tom",
      options: [
        { value: "foreground", label: "Padrão" },
        { value: "muted", label: "Suave" },
        { value: "primary", label: "Destaque" },
      ],
    },
  ],
};
