// International Morse and a small byte-preserving transfer protocol.
export const MORSE = Object.freeze({
  A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....', I:'..', J:'.---', K:'-.-', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.', Q:'--.-', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', W:'.--', X:'-..-', Y:'-.--', Z:'--..',
  0:'-----', 1:'.----', 2:'..---', 3:'...--', 4:'....-', 5:'.....', 6:'-....', 7:'--...', 8:'---..', 9:'----.',
  '.':'.-.-.-', ',':'--..--', '?':'..--..', "'":'.----.', '!':'-.-.--', '/':'-..-.', '(':'-.--.', ')':'-.--.-', '&':'.-...', ':':'---...', ';':'-.-.-.', '=':'-...-', '+':'.-.-.', '-':'-....-', '_':'..--.-', '"':'.-..-.', '@':'.--.-.'
});
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k,v]) => [v,k]));
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const MAX_BYTES = 2048;
export const MAX_STREAM = 16000;
const utf8 = new TextEncoder();
const unutf8 = new TextDecoder('utf-8', { fatal: true });

export function normalizePlain(text) {
  const normalized = text.toUpperCase().replace(/\s+/g, ' ').trim();
  const unsupported = [...new Set([...normalized].filter(c => c !== ' ' && !MORSE[c]))];
  if (unsupported.length) throw new Error(`Plain Morse cannot represent: ${unsupported.join(' ')}. Use Exact transfer to preserve any text.`);
  if (!normalized) throw new Error('Enter some text first.');
  if (normalized.length > 2048) throw new Error('Plain Morse is limited to 2,048 characters.');
  return normalized;
}
export function toMorse(text) {
  return text.split(' ').map(word => [...word].map(c => {
    if (!MORSE[c]) throw new Error(`Unsupported Morse character: ${c}`);
    return MORSE[c];
  }).join(' ')).join(' / ');
}
export function timeline(text) {
  const result = [];
  const words = text.trim().split(/\s+/);
  words.forEach((word, wi) => [...word].forEach((c, ci) => {
    const code = MORSE[c];
    if (!code) throw new Error(`Unsupported Morse character: ${c}`);
    [...code].forEach((s, si) => {
      result.push({ on: true, units: s === '.' ? 1 : 3 });
      if (si < code.length - 1) result.push({ on: false, units: 1 });
    });
    result.push({ on: false, units: ci < word.length - 1 ? 3 : 7 });
  }));
  return result;
}
export function duration(text, wpm) {
  return timeline(text).reduce((n,s) => n+s.units,0) * 1.2 / wpm;
}
export function base32Encode(bytes) {
  let buffer=0, bits=0, out='';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; out += ALPHABET[(buffer >>> bits) & 31]; }
  }
  if (bits) out += ALPHABET[(buffer << (5-bits)) & 31];
  return out;
}
export function base32Decode(text) {
  if (!/^[A-Z2-7]*$/.test(text)) throw new Error('Invalid transfer alphabet.');
  let buffer=0,bits=0; const out=[];
  for (const c of text) {
    buffer = (buffer << 5) | ALPHABET.indexOf(c); bits += 5;
    if (bits >= 8) { bits -= 8; out.push((buffer >>> bits)&255); }
  }
  const bytes = new Uint8Array(out);
  if (base32Encode(bytes) !== text) throw new Error('Incomplete byte encoding.');
  return bytes;
}
export function crc32(...parts) {
  let crc = 0xffffffff;
  for (const bytes of parts) for (const b of bytes) {
    crc ^= b;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8,'0');
}
export function makePacket(bytes, {kind='text', name='message.txt', type='text/plain'}={}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES) throw new Error('Choose a tiny file or text up to 2 KB (2,048 bytes).');
  if (!['text','file'].includes(kind)) throw new Error('Invalid transfer kind.');
  if (typeof name !== 'string' || typeof type !== 'string' || name.length > 120 || type.length > 120) throw new Error('Filename and file type must each be at most 120 characters. Rename this file before sending.');
  const header = utf8.encode(JSON.stringify({k:kind === 'text' ? 't' : 'f', n:name, t:type, s:bytes.length}));
  return `VVV MT1 ${base32Encode(header)} ${bytes.length ? base32Encode(bytes) : '0'} ${crc32(header, bytes)} END`;
}
export function readPacket(frame) {
  const parts = frame.trim().split(/\s+/);
  if (parts.length !== 6 || parts[0] !== 'VVV' || parts[1] !== 'MT1' || parts[5] !== 'END') throw new Error('Incomplete transfer frame.');
  if (parts[2].length > 2000 || parts[3].length > Math.ceil(MAX_BYTES*8/5)) throw new Error('Transfer exceeds the 2 KB limit.');
  const headerBytes = base32Decode(parts[2]);
  const bytes = parts[3] === '0' ? new Uint8Array() : base32Decode(parts[3]);
  if (crc32(headerBytes,bytes) !== parts[4]) throw new Error('Checksum failed. Move the devices closer, reduce speed, and resend.');
  const header = JSON.parse(unutf8.decode(headerBytes));
  if (!header || !['t','f'].includes(header.k) || typeof header.n !== 'string' || typeof header.t !== 'string' || header.n.length>120 || header.t.length>120 || header.s !== bytes.length || bytes.length>MAX_BYTES) throw new Error('Invalid transfer metadata.');
  return {kind:header.k === 't' ? 'text' : 'file', name:header.n, type:header.t, bytes, text:header.k === 't' ? unutf8.decode(bytes) : null};
}
export function framesIn(text) {
  // A payload token may itself be END. Fixed token positions avoid false endings.
  return [...text.matchAll(/(?:^|\s)(VVV MT1 \S+ \S+ \S+ END)(?=\s|$)/g)].map(m => m[1]);
}
export class TimingDecoder {
  constructor(wpm, onCharacter = () => {}) { this.unit=1.2/wpm; this.callback=onCharacter; this.reset(); }
  reset() { this.on=false; this.since=0; this.symbol=''; this.text=''; this.morse=''; }
  append(c, code) {
    this.text = (this.text+c).slice(-MAX_STREAM);
    this.morse = (this.morse+code).slice(-MAX_STREAM*6);
    this.callback(c, this.text, this.morse);
  }
  flush() {
    if (!this.symbol) return;
    this.append(REVERSE[this.symbol] || '?', `${this.symbol} `); this.symbol='';
  }
  space() { if (this.text && !this.text.endsWith(' ')) this.append(' ', '/ '); }
  update(on, time) {
    if (on !== this.on) {
      const elapsed = time-this.since;
      if (this.on) {
        if (elapsed >= this.unit*.3) {
          this.symbol += elapsed < 2*this.unit ? '.' : elapsed <= 4.5*this.unit ? '-' : '?';
          if (this.symbol.length > 6) this.flush();
        }
      } else {
        if (elapsed >= 2*this.unit) this.flush();
        if (elapsed >= 5*this.unit) this.space();
      }
      this.on=on; this.since=time;
    }
    this.advance(time);
  }
  advance(time) {
    if (!this.on) {
      if (time-this.since >= 2*this.unit) this.flush();
      if (time-this.since >= 5*this.unit) this.space();
    }
  }
}
export { ToneDetector } from '../audio/tone-detector.mjs';
