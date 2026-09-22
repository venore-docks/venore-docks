import type { OperationResult } from "@/shared/types";
import type { MenuItemRecord, MenuItemTarget } from "../../../contracts/types";

export type UpdateMenuItemCommand = {
  id: string;
  label?: string;
  isVisible?: boolean;
  target?: MenuItemTarget;
  // Mesma chave lógica de contexts/themes/contracts/types.ts — ver create-menu-item/types.ts
  // sobre por que não é validada contra um registro de ícones aqui.
  icon?: string | null;
  // Mesma regra de create-menu-item/types.ts — sem efeito em target "external"/"label". Ausente
  // (undefined) == "não mexe no campo" (mesmo padrão de label/isVisible/icon acima).
  openInNewTab?: boolean;
  actorId: string;
};
export type UpdateMenuItemInput = Omit<UpdateMenuItemCommand, "actorId">;
export type UpdateMenuItemResult = OperationResult<MenuItemRecord>;
