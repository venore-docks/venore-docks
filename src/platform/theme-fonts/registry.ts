import {
  Fraunces,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Manrope,
  Noto_Sans_Arabic,
  Noto_Sans_Hebrew,
  Playfair_Display,
  Source_Serif_4,
  Space_Grotesk,
} from "next/font/google";
import type { FontId } from "@/contexts/themes/contracts/v8";

// Registro estático de fontes (spec §7.6): chamadas next/font/google em escopo de módulo, com
// opções literais (exigência do next/font — nada de loop/objeto calculado). Preload é decidido pelo
// arquivo que importa, não por request: só Geist/Geist Mono (o padrão, usado em todo admin)
// pré-carregam; as demais são `preload: false` e só baixam quando a classe `.variable` delas está
// no <html> e algum texto usa a família. O nome de cada `variable` precisa bater com
// FONT_CATALOG[id].cssVariable (./catalog.ts; registry.test.ts confere).
const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap", preload: false });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", preload: false });
const playfairDisplay = Playfair_Display({ variable: "--font-playfair-display", subsets: ["latin"], display: "swap", preload: false });
const sourceSerif4 = Source_Serif_4({ variable: "--font-source-serif-4", subsets: ["latin"], display: "swap", preload: false });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap", preload: false });
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const notoSansArabic = Noto_Sans_Arabic({ variable: "--font-noto-sans-arabic", subsets: ["arabic"], display: "swap", preload: false });
const notoSansHebrew = Noto_Sans_Hebrew({ variable: "--font-noto-sans-hebrew", subsets: ["hebrew"], display: "swap", preload: false });

// Classe `.variable` (declara a variável CSS da família) de cada fonte curada.
export const FONT_VARIABLE_CLASS_NAMES: Readonly<Record<FontId, string>> = {
  geist: geist.variable,
  "geist-mono": geistMono.variable,
  inter: inter.variable,
  manrope: manrope.variable,
  "space-grotesk": spaceGrotesk.variable,
  fraunces: fraunces.variable,
  "playfair-display": playfairDisplay.variable,
  "source-serif-4": sourceSerif4.variable,
  "jetbrains-mono": jetbrainsMono.variable,
  "ibm-plex-mono": ibmPlexMono.variable,
  "noto-sans-arabic": notoSansArabic.variable,
  "noto-sans-hebrew": notoSansHebrew.variable,
};

// Admin e tema sem escolha: Geist + Geist Mono, como antes da v8.
export const DEFAULT_FONT_CLASS_NAMES = `${geist.variable} ${geistMono.variable}`;
