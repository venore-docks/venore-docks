import type { OperationResult } from "@/shared/types";
import type { MenuItemRecord, MenuItemTarget } from "../../../contracts/types";

export type CreateMenuItemCommand = {
  menuId: string;
  label: string;
  parentId?: string | null;
  target: MenuItemTarget;
  // Chave lógica de ícone (contexts/themes/contracts/types.ts — NavItem/MainNavItem.icon), nunca
  // validada contra um registro fixo aqui: cms não conhece tema/platform/nav-icons (contexts não
  // dependem de platform/), quem restringe as opções é o <Select> do editor. Chave desconhecida
  // no momento da renderização só cai no fallback genérico do tema, nunca quebra.
  icon?: string | null;
  // Só tem efeito em target "content"/"route" — "external" abre em nova aba sempre, independente
  // deste campo (menu-resolution.ts). Ausente == false (link interno abre na mesma aba).
  openInNewTab?: boolean;
  actorId: string;
};
export type CreateMenuItemInput = Omit<CreateMenuItemCommand, "actorId">;
export type CreateMenuItemResult = OperationResult<MenuItemRecord>;
