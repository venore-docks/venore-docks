import { getMediaAsset } from "@/contexts/media";
import { getSetting, registerDefaultSetting } from "@/contexts/settings";
import type { HeaderBrandMode } from "@/contexts/themes";

// Conteúdo de marca — nome, logos, favicon, descrição do rodapé. Estética (mode/size/
// scrolledSize/position/color) migrou pro tema ativo (T2, docs/implementation-roadmap.md —
// Fase 5, ThemeManifest.brandAesthetics): aqui só sobra o que é dado de negócio editável pelo
// admin em /admin/settings/brand, não decisão de design.
export type BrandConfig = {
  siteName: string;
  logoUrl: string;
  scrolledLogoUrl: string;
  faviconUrl: string;
  footerDescription: string;
};

const KEYS = {
  siteName: "brand.siteName",
  logoMediaId: "brand.logoMediaId",
  logoScrolledMediaId: "brand.logoScrolledMediaId",
  faviconMediaId: "brand.faviconMediaId",
  footerDescription: "brand.footerDescription",
} as const;

// Default de código NEUTRO de propósito — o default embutido não pode carregar
// identidade de tenant (foi "Aprenda Música" até a 0030/0032; ver
// drizzle/0032_aprenda_musica_brand_no_longer_in_core.sql). Cada instalação define a própria
// marca em /admin/settings/brand — core nunca semeia identidade de tenant (não existe mais um
// script tipo `db:seed:aprenda-musica`; um plugin que precise de dado inicial próprio usa
// `contributions.seeds`, rodado no install de /admin/plugins).
const DEFAULTS = {
  siteName: "Meu Site",
  logoMediaId: "",
  logoScrolledMediaId: "",
  faviconMediaId: "",
  // Frase de exemplo NEUTRA (não carrega identidade de tenant, mesma regra do siteName) — sem
  // ela o rodapé fica só com a marca solta num painel vazio. O admin ajusta em
  // /admin/settings/brand; registerDefaultSetting persiste esta na primeira leitura, então ela
  // aparece já preenchida no formulário como ponto de partida.
  footerDescription: "Plataforma modular para conteúdo, comunidade e operação.",
};

const FALLBACK_LOGO_SVG = "/brand/brand-logo.svg";
const FALLBACK_LOGO_PNG = "/brand/brand-logo.png";
const FALLBACK_LOGO_SCROLLED_PNG = "/brand/brand-logo-scrolled.png";
const FALLBACK_FAVICON = "/brand/favicon.ico";

// registerDefaultSetting faz onConflictDoNothing por chave (contexts/settings/features/
// register-default-setting/store.ts) — chamar a cada leitura é seguro e barato (upsert
// indexado que só grava na primeira vez). Não existe hoje um bootstrap real de app onde
// registrar isso uma única vez (register-plugins.ts nunca é invocado em produção), então esta
// é a única chamada que garante o default persistido sem inventar infra nova.
async function readStringSetting(key: string, defaultValue: string): Promise<string> {
  await registerDefaultSetting({ key, value: defaultValue });
  const result = await getSetting({ key });
  if (!result.success) return defaultValue;
  const record = result.data;
  if (!record || typeof record.value !== "string") return defaultValue;
  return record.value;
}

async function resolveMediaUrl(mediaId: string, fallback: string): Promise<string> {
  if (!mediaId) return fallback;
  const result = await getMediaAsset({ id: mediaId });
  if (!result.success || !result.data) return fallback;
  return result.data.url;
}

// `mode` vem do tema ativo (BrandAesthetics.mode, T2) — só é usado aqui pra escolher a extensão
// certa do fallback de logo quando nenhuma mídia foi selecionada; default "svg" cobre os
// chamadores que não precisam de precisão de fallback (ex: layout.tsx só lê faviconUrl).
export async function getBrandConfig(mode: HeaderBrandMode = "svg"): Promise<BrandConfig> {
  const [siteName, logoMediaId, logoScrolledMediaId, faviconMediaId, footerDescription] = await Promise.all([
    readStringSetting(KEYS.siteName, DEFAULTS.siteName),
    readStringSetting(KEYS.logoMediaId, DEFAULTS.logoMediaId),
    readStringSetting(KEYS.logoScrolledMediaId, DEFAULTS.logoScrolledMediaId),
    readStringSetting(KEYS.faviconMediaId, DEFAULTS.faviconMediaId),
    readStringSetting(KEYS.footerDescription, DEFAULTS.footerDescription),
  ]);

  const fallbackLogo = mode === "png" ? FALLBACK_LOGO_PNG : FALLBACK_LOGO_SVG;

  const [logoUrl, scrolledLogoUrl, faviconUrl] = await Promise.all([
    resolveMediaUrl(logoMediaId, fallbackLogo),
    resolveMediaUrl(logoScrolledMediaId, FALLBACK_LOGO_SCROLLED_PNG),
    resolveMediaUrl(faviconMediaId, FALLBACK_FAVICON),
  ]);

  return {
    siteName,
    logoUrl,
    scrolledLogoUrl,
    faviconUrl,
    footerDescription: footerDescription.trim() || DEFAULTS.footerDescription,
  };
}

export { KEYS as BRAND_SETTING_KEYS };
