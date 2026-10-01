// Modo manutenção (settings platform.maintenance, spec §7.9): conteúdo escondido de quem não é
// admin. Dono: W4 — na Fase F, nunca em manutenção.
export async function resolveMaintenance(gate: { granted: boolean }): Promise<boolean> {
  void gate;
  return false;
}
