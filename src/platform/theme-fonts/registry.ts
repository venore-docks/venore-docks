import { Geist, Geist_Mono } from "next/font/google";

// Registro estático de fontes (spec §7.6): chamadas next/font/google em escopo de módulo, com
// opções literais (exigência do next/font). Preload é decidido pelo arquivo que importa, por isso
// só Geist/Geist Mono pré-carregam; as demais (W8) entram com `preload: false`. Dono: W8 — na
// Fase F só as duas que o root layout já usava, movidas sem mudança.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const DEFAULT_FONT_CLASS_NAMES = `${geistSans.variable} ${geistMono.variable}`;
