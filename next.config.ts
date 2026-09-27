import { createRequire } from "node:module";
import type { NextConfig } from "next";

// Plugins são pacotes npm `@venore/plugin-*` (docs/plugins-repos-separados-plano.md) publicados
// como TypeScript cru — o Next transpila via transpilePackages. Lista derivada das dependencies,
// sem nome de plugin hard-coded.
const hostPkg = createRequire(import.meta.url)("./package.json") as { dependencies?: Record<string, string> };
// Pacotes @venore/* (plugin e tema) são TS cru — o Next transpila. Os *-sdk são alias de tsconfig,
// não pacote, então ficam de fora.
const venorePackages = Object.keys(hostPkg.dependencies ?? {}).filter(
  (dep) => dep.startsWith("@venore/") && !dep.endsWith("-sdk"),
);

const nextConfig: NextConfig = {
  transpilePackages: venorePackages,
  allowedDevOrigins: ["192.168.6.8"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    // Proteções que valem pra toda resposta. A Content Security Policy (com nonce por request)
    // mora em src/proxy.ts; X-Frame-Options fica de fora quando FRAME_ANCESTORS libera outros
    // sites a embutir o app (o frame-ancestors da CSP decide nesse caso).
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
        : []),
      ...(process.env.FRAME_ANCESTORS ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Service worker da PWA (public/sw.js): nunca cacheado pelo navegador (senão uma versão
        // nova nunca chega) e pode controlar todo o site.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        // O navegador pede GET /favicon.ico na raiz por conta própria (aba, favoritos, histórico),
        // independente do <link rel="icon"> no <head>. Sem src/app/favicon.ico (removido pra não
        // travar a customização do admin), isso daria 404. Aqui aponta pro fallback de marca — o
        // <link> do metadata ainda manda pra aba quando há um favicon customizado.
        source: "/favicon.ico",
        destination: "/brand/favicon.ico",
      },
    ];
  },
};

export default nextConfig;
