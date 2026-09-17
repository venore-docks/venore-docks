import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries, menuItems, menus } from "../../../database/schema";
import type { MenuItemRecord, MenuRecord } from "../../../contracts/types";

export async function findMenuById(id: string): Promise<MenuRecord | null> {
  const [row] = await db.select().from(menus).where(eq(menus.id, id)).limit(1);
  return (row as MenuRecord) ?? null;
}

export async function findMenuItemsByMenuId(menuId: string): Promise<MenuItemRecord[]> {
  const rows = await db.select().from(menuItems).where(eq(menuItems.menuId, menuId));
  return rows as MenuItemRecord[];
}

export async function findEntryExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: entries.id }).from(entries).where(eq(entries.id, id)).limit(1);
  return Boolean(row);
}

export async function insertMenuItem(input: {
  menuId: string;
  parentId: string | null;
  label: string;
  order: number;
  targetType: string;
  contentId: string | null;
  anchor: string | null;
  routePath: string | null;
  requiredPermissionKey: string | null;
  externalUrl: string | null;
  icon: string | null;
}): Promise<MenuItemRecord> {
  const [row] = await db.insert(menuItems).values(input).returning();
  return row as MenuItemRecord;
}
