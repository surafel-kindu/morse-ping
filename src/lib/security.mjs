import { MORSE } from './morse.mjs';

export const SHUFFLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function normalizeShuffleCode(code) {
  if (typeof code !== 'string' || code.length > 128) throw new Error('Enter a shuffled alphabet with all 36 letters and digits once.');
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  if (normalized.length !== SHUFFLE_ALPHABET.length || new Set(normalized).size !== SHUFFLE_ALPHABET.length || [...normalized].some(character => !SHUFFLE_ALPHABET.includes(character))) {
    throw new Error('Generate a shuffle or enter A–Z and 0–9 exactly once, in any order.');
  }
  return normalized;
}
export function createShuffleMapping(code) {
  const alphabet = normalizeShuffleCode(code);
  const forward = Object.fromEntries([...SHUFFLE_ALPHABET].map((character, index) => [character, alphabet[index]]));
  const reverse = Object.fromEntries(Object.entries(forward).map(([character, replacement]) => [replacement, character]));
  return { alphabet, forward, reverse };
}
function substitute(text, mapping) {
  return [...text].map(character => {
    if (mapping[character]) return mapping[character];
    if (character === ' ' || MORSE[character]) return character;
    throw new Error(`Unsupported shuffle character: ${character}. Use Exact transfer for Unicode.`);
  }).join('');
}
export function shuffleCharacters(text, code) { return substitute(text, createShuffleMapping(code).forward); }
export function unshuffleCharacters(text, code) { return substitute(text, createShuffleMapping(code).reverse); }
export function swapShuffleMapping(code, source, replacement) {
  if (!SHUFFLE_ALPHABET.includes(source) || source.length !== 1 || !SHUFFLE_ALPHABET.includes(replacement) || replacement.length !== 1) throw new Error('Choose a letter or number to map.');
  const alphabet = [...normalizeShuffleCode(code)];
  const sourceIndex = SHUFFLE_ALPHABET.indexOf(source), otherIndex = alphabet.indexOf(replacement);
  [alphabet[sourceIndex], alphabet[otherIndex]] = [alphabet[otherIndex], alphabet[sourceIndex]];
  return alphabet.join('');
}
export function generateShuffleCode() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Random generation is unavailable. Enter a shuffled alphabet manually.');
  const alphabet = [...SHUFFLE_ALPHABET];
  const random = new Uint32Array(1);
  for (let index = alphabet.length - 1; index > 0; index--) {
    const range = index + 1, limit = Math.floor(2 ** 32 / range) * range;
    do { globalThis.crypto.getRandomValues(random); } while (random[0] >= limit);
    const other = random[0] % range;
    [alphabet[index], alphabet[other]] = [alphabet[other], alphabet[index]];
  }
  return alphabet.join('');
}
