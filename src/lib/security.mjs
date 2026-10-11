import { base32Encode, base32Decode, crc32, makePacket, readPacket } from './morse.mjs';

const utf8 = new TextEncoder();
const unutf8 = new TextDecoder('utf-8', { fatal: true });
// Fixed suite: no peer-supplied algorithm or work-factor negotiation.
const CONTEXT = utf8.encode('Morse Transfer / MTE1 / AES-256-GCM / HKDF-SHA-256');
const MAX_CIPHER_BYTES = 6000;

function cryptoAPI() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure transfers require Web Crypto. Open this page over HTTPS or localhost.');
  }
  return globalThis.crypto;
}
export function normalizeSecret(code) {
  if (typeof code !== 'string' || code.length > 128) throw new Error('Enter a shared code with 32 Base32 characters.');
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z2-7]{32}$/.test(normalized)) throw new Error('Enter the same 32-character shared code on both devices. Use Generate code to create one.');
  return normalized;
}
export function generateSecret() {
  const code = base32Encode(cryptoAPI().getRandomValues(new Uint8Array(20)));
  return code.match(/.{4}/g).join('-');
}
async function deriveKey(code, salt) {
  const api = cryptoAPI();
  const material = await api.subtle.importKey('raw', base32Decode(normalizeSecret(code)), 'HKDF', false, ['deriveKey']);
  return api.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: CONTEXT }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptPacket(bytes, metadata, code) {
  normalizeSecret(code);
  const inner = makePacket(bytes, metadata);
  readPacket(inner); // Enforce the receiver’s metadata/encoding bounds before sending.
  const plaintext = utf8.encode(inner);
  const api = cryptoAPI();
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const ciphertext = new Uint8Array(await api.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: CONTEXT, tagLength: 128 }, key, plaintext));
  if (ciphertext.length > MAX_CIPHER_BYTES) throw new Error('Encrypted transfer is too large.');
  return `VVV MTE1 ${base32Encode(salt)} ${base32Encode(iv)} ${base32Encode(ciphertext)} ${crc32(salt, iv, ciphertext)} END`;
}
export function encryptedFramesIn(text) {
  return [...text.matchAll(/(?:^|\s)(VVV MTE1 \S+ \S+ \S+ \S+ END)(?=\s|$)/g)].map(match => match[1]);
}
export function readEncryptedPacket(frame) {
  if (typeof frame !== 'string' || frame.length > 9800) throw new Error('Encrypted transfer exceeds the size limit.');
  const parts = frame.trim().split(/\s+/);
  if (parts.length !== 7 || parts[0] !== 'VVV' || parts[1] !== 'MTE1' || parts[6] !== 'END') throw new Error('Incomplete encrypted transfer frame.');
  if (parts[2].length !== 26 || parts[3].length !== 20 || parts[4].length > Math.ceil(MAX_CIPHER_BYTES * 8 / 5) || !/^[A-F0-9]{8}$/.test(parts[5])) throw new Error('Invalid encrypted transfer metadata.');
  const salt = base32Decode(parts[2]), iv = base32Decode(parts[3]), ciphertext = base32Decode(parts[4]);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error('Invalid encrypted transfer metadata.');
  if (crc32(salt, iv, ciphertext) !== parts[5]) throw new Error('Encrypted packet checksum failed. Reduce speed and resend the whole message.');
  return { salt, iv, ciphertext };
}
export async function decryptPacket(frame, code) {
  const { salt, iv, ciphertext } = readEncryptedPacket(frame);
  const key = await deriveKey(code, salt);
  let plaintext;
  try {
    plaintext = await cryptoAPI().subtle.decrypt({ name: 'AES-GCM', iv, additionalData: CONTEXT, tagLength: 128 }, key, ciphertext);
  } catch {
    throw new Error('Unable to unlock: the shared code is wrong or this packet was altered. No content was released.');
  }
  const result = readPacket(unutf8.decode(plaintext));
  return { ...result, verified: true, encrypted: true, locked: false };
}
