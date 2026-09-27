import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Formato de senha do projeto:
//   atual:  `scrypt2$<N>$<r>$<p>$<saltBase64>$<hashBase64>` (parâmetros no próprio hash)
//   legado: `scrypt$<saltBase64>$<hashBase64>`               (N=16384, r=8, p=1 implícitos)
// Parâmetros atuais = uma das configurações mínimas da OWASP pra scrypt (N=2^15, r=8, p=3; 32 MiB
// por hash). O legado continua sendo aceito no login e é regravado no formato atual
// (needsRehash) — migração transparente, sem forçar troca de senha.
// Módulo interno do context de auth — não é reexportado pelo barrel.
const CURRENT_PARAMS = { N: 32768, r: 8, p: 3 } as const;
const LEGACY_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const DERIVED_KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// Folga sobre 128*N*r (32 MiB) — o maxmem default do Node (32 MiB) recusaria N=2^15/r=8 no limite.
const MAX_MEMORY = 64 * 1024 * 1024;

type ScryptParams = { N: number; r: number; p: number };

function derive(password: string, salt: Buffer, keyLength: number, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEMORY };
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await derive(password, salt, DERIVED_KEY_LENGTH, CURRENT_PARAMS);
  const { N, r, p } = CURRENT_PARAMS;
  return `scrypt2$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function parse(storedHash: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const parts = storedHash.split("$");
  if (parts[0] === "scrypt" && parts.length === 3 && parts[1] && parts[2]) {
    return { params: LEGACY_PARAMS, salt: Buffer.from(parts[1], "base64"), hash: Buffer.from(parts[2], "base64") };
  }
  if (parts[0] === "scrypt2" && parts.length === 6) {
    const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    // Teto defensivo: um hash adulterado com N gigante travaria o processo no login.
    if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;
    if (!parts[4] || !parts[5]) return null;
    return { params: { N, r, p }, salt: Buffer.from(parts[4], "base64"), hash: Buffer.from(parts[5], "base64") };
  }
  return null;
}

export async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  const parsed = parse(storedHash);
  if (!parsed || parsed.hash.length === 0) return false;
  const derived = await derive(password, parsed.salt, parsed.hash.length, parsed.params);
  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}

// true quando o hash não usa os parâmetros atuais — o login regrava com hashPassword.
export function needsRehash(storedHash: string): boolean {
  const parsed = parse(storedHash);
  if (!parsed) return false;
  const { N, r, p } = parsed.params;
  return !storedHash.startsWith("scrypt2$") || N !== CURRENT_PARAMS.N || r !== CURRENT_PARAMS.r || p !== CURRENT_PARAMS.p;
}

// Mesmo custo de um verify real — o login chama isto quando o e-mail não existe, pra que o tempo
// de resposta não revele quais e-mails têm conta.
const DUMMY_SALT = randomBytes(SALT_LENGTH);
export async function burnPasswordVerificationTime(password: string): Promise<void> {
  await derive(password, DUMMY_SALT, DERIVED_KEY_LENGTH, CURRENT_PARAMS);
}
