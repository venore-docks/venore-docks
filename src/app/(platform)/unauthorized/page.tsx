import { renderState } from "@/platform/theme-rendering/render-state";
import { resolveTemplateContext } from "@/platform/theme-rendering/render-template";

// Estado "forbidden" do tema (spec v8 §7.9) — o kit desenha a mesma moldura de antes da v8.
export default async function UnauthorizedPage() {
  const context = await resolveTemplateContext();
  return renderState(context.theme, "forbidden", {
    ...context.common,
    title: "Acesso não autorizado",
    message: "Você não tem permissão para acessar esta página.",
    action: { href: "/login", label: "Ir para o login" },
  });
}
