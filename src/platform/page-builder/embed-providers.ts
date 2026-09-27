// Converte o link que o editor cola (página do YouTube, Vimeo, Spotify, embed do Google Maps) no
// endereço de iframe oficial do provedor. Qualquer outra coisa devolve null e o bloco não renderiza:
// iframe de URL arbitrária permitiria embutir páginas de phishing/tracking no site.
export type EmbedTarget = { provider: "youtube" | "vimeo" | "google-maps" | "spotify"; src: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeStartSeconds(url: URL): number | null {
  const raw = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!raw) return null;
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return seconds > 0 ? seconds : null;
}

export function parseEmbedUrl(raw: string): EmbedTarget | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    const id =
      host === "youtu.be"
        ? segments[0]
        : segments[0] === "watch"
          ? url.searchParams.get("v")
          : ["embed", "shorts", "live"].includes(segments[0] ?? "")
            ? segments[1]
            : null;
    if (!id || !YOUTUBE_ID.test(id)) return null;
    const start = youtubeStartSeconds(url);
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ""}` };
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const id = host === "player.vimeo.com" ? (segments[0] === "video" ? segments[1] : null) : segments.find((part) => /^\d+$/.test(part));
    if (!id || !/^\d+$/.test(id)) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }

  // Google Maps: só o endereço de embed ("Compartilhar > Incorporar um mapa").
  if ((host === "www.google.com" || host === "google.com") && url.pathname.startsWith("/maps/embed")) {
    return { provider: "google-maps", src: `https://www.google.com${url.pathname}${url.search}` };
  }

  if (host === "open.spotify.com") {
    const offset = segments[0] === "embed" ? 1 : 0;
    const kind = segments[offset];
    const id = segments[offset + 1];
    if (!["track", "album", "playlist", "episode", "show", "artist"].includes(kind ?? "") || !id || !/^[A-Za-z0-9]+$/.test(id)) return null;
    return { provider: "spotify", src: `https://open.spotify.com/embed/${kind}/${id}` };
  }

  return null;
}
