import type { ComponentType } from "react";
import type { TemplatePropsByKey } from "@/contexts/themes/contracts/v8";
import { KitCategoryTemplate } from "./category-template";
import { KitEntryTemplate } from "./entry-template";
import { KitAccountTemplate, KitHomeTemplate, KitLoginTemplate, KitNotFoundTemplate } from "./simple-templates";

// Templates do kit por chave (spec §2.7). Dono: W4.
export const KIT_TEMPLATES: { [K in keyof TemplatePropsByKey]: ComponentType<TemplatePropsByKey[K]> } = {
  home: KitHomeTemplate,
  entry: KitEntryTemplate,
  category: KitCategoryTemplate,
  account: KitAccountTemplate,
  login: KitLoginTemplate,
  notFound: KitNotFoundTemplate,
};
export { KitHomeTemplate, KitEntryTemplate, KitCategoryTemplate, KitAccountTemplate, KitLoginTemplate, KitNotFoundTemplate };
