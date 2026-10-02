import type { ThemeOutletName, ThemeOutletNodes } from "@/contexts/themes/contracts/v8";

// <ThemeOutlet> (spec §7.4): wrapper sem caixa (`display: contents`) com o marcador
// `data-outlet`, ou nada quando o outlet está vazio. Dono: W3 (uso nas regiões), W7 (conteúdo).
export function ThemeOutlet({ name, nodes }: { name: ThemeOutletName; nodes: ThemeOutletNodes }) {
  const node = nodes[name];
  if (node == null || node === false) return null;
  return (
    <div data-outlet={name} style={{ display: "contents" }}>
      {node}
    </div>
  );
}
