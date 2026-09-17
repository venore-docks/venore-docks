// A recolorização por CSS mask (ver PlatformBrand de cada tema) só faz sentido para um asset
// vetorial/alpha-shaped como SVG — aplicada a um PNG opaco, a máscara pinta a caixa inteira de
// `currentColor` (o bug da "caixa branca"). `mode` no manifesto do tema é uma decisão estática de
// design, não deriva do arquivo enviado; esta função é o que decide, por extensão da URL (o
// upload de mídia preserva o nome/extensão original no path), se o asset atual pode ser
// recolorido com segurança.
export function isRecolorableBrandAsset(url: string): boolean {
  return /\.svg(\?.*)?$/i.test(url);
}
