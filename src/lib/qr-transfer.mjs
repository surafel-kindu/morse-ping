import { base32Encode, base32Decode, crc32 } from './morse.mjs';
import { createShuffleMapping, shuffleCharacters, unshuffleCharacters } from './security.mjs';

export const QR_MAX_BYTES = 1024 * 1024;
export const QR_CHUNK_BYTES = 240;
export const QR_RATES = [1, 2, 4, 5, 8, 10, 15, 20];
const PREFIX = 'QRT1|';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const encodeFrame = frame => PREFIX + JSON.stringify(frame);
const header = m => JSON.stringify({ k: m.k, n: m.n, m: m.m, s: m.s, c: m.c, z: m.z, sh: m.sh });
const hex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function checksum(manifest, bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('QR integrity checks require HTTPS or localhost.');
  const metadata = encoder.encode(header(manifest));
  const input = new Uint8Array(metadata.length + bytes.length);
  input.set(metadata); input.set(bytes, metadata.length);
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}
function validateManifest(m) {
  if (!['text', 'file'].includes(m.k) || typeof m.n !== 'string' || typeof m.m !== 'string' || m.n.length > 120 || m.m.length > 120 || !Number.isSafeInteger(m.s) || m.s < 0 || m.s > QR_MAX_BYTES || m.z !== QR_CHUNK_BYTES || m.c !== Math.ceil(m.s / m.z) || typeof m.sh !== 'boolean' || !/^[a-f0-9]{64}$/.test(m.h)) throw new Error('Invalid QR transfer size or metadata. Maximum size is 1 MB.');
}
function parseFrame(raw) {
  if (typeof raw !== 'string' || !raw.startsWith(PREFIX)) return null;
  if (raw.length > 2000) throw new Error('QR frame is too large.');
  let frame;
  try { frame = JSON.parse(raw.slice(PREFIX.length)); } catch { throw new Error('Damaged QR frame. Keep scanning the next loop.'); }
  if (!frame || !['S', 'D', 'E'].includes(frame.t) || typeof frame.id !== 'string' || !/^[a-f0-9]{32}$/.test(frame.id)) throw new Error('Invalid QR frame.');
  if (frame.t !== 'D') validateManifest(frame);
  else if (!Number.isSafeInteger(frame.i) || frame.i < 0 || typeof frame.p !== 'string' || frame.p.length > Math.ceil(QR_CHUNK_BYTES * 8 / 5) || !/^[A-Z0-9]*$/.test(frame.p) || typeof frame.crc !== 'string' || !/^[A-F0-9]{8}$/.test(frame.crc)) throw new Error('Invalid QR data chunk. Keep scanning the next loop.');
  return frame;
}

export async function createQrTransfer(bytes, { kind = 'text', name = 'message.txt', type = 'text/plain', shuffle = false, code = '' } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > QR_MAX_BYTES) throw new Error('QR transfers support up to 1 MB (1,048,576 bytes).');
  if (shuffle) createShuffleMapping(code);
  bytes = bytes.slice();
  const manifest = { id: hex(crypto.getRandomValues(new Uint8Array(16))), k: kind, n: name, m: type, s: bytes.length, c: Math.ceil(bytes.length / QR_CHUNK_BYTES), z: QR_CHUNK_BYTES, sh: shuffle, h: '0'.repeat(64) };
  validateManifest(manifest);
  manifest.h = await checksum(manifest, bytes);
  return {
    manifest, frameCount: manifest.c + 2,
    frameAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= manifest.c + 2) throw new Error('Invalid QR frame index.');
      if (index === 0 || index === manifest.c + 1) return encodeFrame({ t: index === 0 ? 'S' : 'E', ...manifest });
      const chunk = bytes.subarray((index - 1) * QR_CHUNK_BYTES, index * QR_CHUNK_BYTES);
      const payload = base32Encode(chunk);
      return encodeFrame({ t: 'D', id: manifest.id, i: index - 1, p: shuffle ? shuffleCharacters(payload, code) : payload, crc: crc32(chunk) });
    },
  };
}
export async function prepareQrInput({ inputKind, text, file, shuffle, code }) {
  if (inputKind === 'text') {
    if (!text.length) throw new Error('Enter text to prepare a QR transfer.');
    return createQrTransfer(encoder.encode(text), { shuffle, code });
  }
  if (!file) throw new Error('Choose a file for QR transfer.');
  if (file.size > QR_MAX_BYTES) throw new Error('Choose a file up to 1 MB (1,048,576 bytes).');
  return createQrTransfer(new Uint8Array(await file.arrayBuffer()), { kind: 'file', name: file.name, type: file.type || 'application/octet-stream', shuffle, code });
}

export function createQrCollector({ shuffle = false, code = '', onProgress = () => {}, onResult = () => {} } = {}) {
  if (shuffle) createShuffleMapping(code);
  let manifest = null, chunks = new Map(), start = false, end = false, receivedBytes = 0, result = null, verifying = null, generation = 0;
  function snapshot() {
    return { manifest, received: chunks.size, total: manifest?.c || 0, receivedBytes, size: manifest?.s || 0, start, end, complete: Boolean(result), verifying: Boolean(verifying) };
  }
  const progress = () => onProgress(snapshot());
  async function complete() {
    if (result || verifying || !manifest || !start || !end || chunks.size !== manifest.c) return verifying;
    const currentGeneration = generation;
    const currentManifest = manifest;
    const bytes = new Uint8Array(manifest.s);
    for (let index = 0; index < manifest.c; index++) bytes.set(chunks.get(index), index * manifest.z);
    verifying = (async () => {
      const hash = await checksum(currentManifest, bytes);
      if (currentGeneration !== generation) return;
      if (hash !== currentManifest.h) {
        chunks.clear(); receivedBytes = 0;
        throw new Error('Complete QR checksum failed. Chunks were cleared; keep scanning to collect a fresh loop.');
      }
      const text = currentManifest.k === 'text' ? decoder.decode(bytes) : null;
      result = { kind: currentManifest.k, name: currentManifest.n, type: currentManifest.m, bytes, text, verified: true, shuffled: currentManifest.sh };
      onResult(result);
    })();
    progress();
    try { await verifying; }
    finally { if (currentGeneration === generation) { verifying = null; progress(); } }
  }
  return {
    snapshot,
    cancelVerification() { generation++; verifying = null; },
    reset() { generation++; manifest = null; chunks = new Map(); start = false; end = false; receivedBytes = 0; result = null; verifying = null; progress(); },
    async accept(raw) {
      const frame = parseFrame(raw);
      if (!frame) return 'ignored';
      if (result) return 'complete';
      if (manifest && frame.id !== manifest.id) return 'other-transfer';
      if (frame.t === 'D' && !manifest) return 'waiting-start';
      let changed = false;
      if (frame.t !== 'D') {
        if (frame.sh !== shuffle) throw new Error('Shuffle settings differ. Match the sender, then clear and restart the receiver.');
        if (manifest && (header(frame) !== header(manifest) || frame.h !== manifest.h)) throw new Error('QR manifest changed within this transfer. Clear to receive another transfer.');
        if (!manifest) { manifest = frame; changed = true; }
        if (frame.t === 'S' && !start) { start = true; changed = true; }
        if (frame.t === 'E' && !end) { end = true; changed = true; }
      } else {
        if (frame.i >= manifest.c) throw new Error('QR chunk index exceeds the declared size.');
        const payload = shuffle ? unshuffleCharacters(frame.p, code) : frame.p;
        const bytes = base32Decode(payload);
        const expectedSize = Math.min(manifest.z, manifest.s - frame.i * manifest.z);
        if (bytes.length !== expectedSize || crc32(bytes) !== frame.crc) throw new Error('QR chunk checksum failed. Match the shared alphabet and keep scanning the next loop.');
        if (chunks.has(frame.i)) {
          if (crc32(chunks.get(frame.i)) !== frame.crc || base32Encode(chunks.get(frame.i)) !== payload) throw new Error('Conflicting QR chunk. Clear and restart this transfer.');
        } else { chunks.set(frame.i, bytes); receivedBytes += bytes.length; changed = true; }
      }
      if (changed) progress();
      await complete();
      return result ? 'complete' : 'accepted';
    },
  };
}
export function formatBytes(size) { return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }
