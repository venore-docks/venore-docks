import { findAllConnections } from "./store";
import type { ListConnectionsResult } from "./types";

export async function listConnections(): Promise<ListConnectionsResult> {
  const connections = await findAllConnections();
  return { success: true, data: connections };
}
