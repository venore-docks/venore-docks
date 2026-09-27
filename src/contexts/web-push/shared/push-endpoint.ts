// Allowlist dos serviços de push dos navegadores. O endpoint vem do cliente e o servidor faz um
// POST nele a cada notificação — sem allowlist, qualquer usuário logado cadastrava uma URL
// interna (metadata da nuvem, serviços da rede privada) e o servidor a chamava (SSRF).
const DEFAULT_PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge em Android, Opera, Samsung
  "android.googleapis.com", // endpoints antigos do Chrome
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari
];
// Edge/Windows usa subdomínios regionais (wns2-*.notify.windows.com etc.).
const DEFAULT_PUSH_HOST_SUFFIXES = [".notify.windows.com", ".push.apple.com"];

const MAX_ENDPOINT_LENGTH = 2048;

function extraHosts(): string[] {
  return (process.env.WEB_PUSH_EXTRA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (DEFAULT_PUSH_HOSTS.includes(host) || extraHosts().includes(host)) return true;
  return DEFAULT_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

// Chaves da inscrição são base64url curtas (p256dh ~87 chars, auth ~22).
export function isValidSubscriptionKey(value: string): boolean {
  return value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_-]+={0,2}$/.test(value);
}
