// Área decidida SÓ pelo caminho (invariante §0.5 da v8), nunca pelo navMode: /admin e /admin/**.
export function areaForPathname(pathname: string | null): "public" | "admin" {
  return pathname === "/admin" || pathname?.startsWith("/admin/") ? "admin" : "public";
}
