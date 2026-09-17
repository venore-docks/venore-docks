import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries, menuItems } from "../../../database/schema";
import type { MenuItemRecord } from "../../../contracts/types";

export async function findMenuItemById(id: string): Promise<MenuItemRecord | null> {
  const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return (row as MenuItemRecord) ?? null;
}

export async function findEntryExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: entries.id }).from(entries).where(eq(entries.id, id)).limit(1);
  return Boolean(row);
}

export async function updateMenuItemFields(
  id: string,
  fields: {
    label?: string;
    isVisible?: boolean;
    icon?: string | null;
    targetType?: string;
    contentId?: string | null;
    anchor?: string | null;
    routePath?: string | null;
    requiredPermissionKey?: string | null;
    externalUrl?: string | null;
  },
): Promise<MenuItemRecord> {
  const [row] = await db
    .update(menuItems)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(menuItems.id, id))
    .returning();
  return row as MenuItemRecord;
}
