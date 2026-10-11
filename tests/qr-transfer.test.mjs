import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createQrTransfer, createQrCollector, prepareQrInput, QR_MAX_BYTES, QR_CHUNK_BYTES } from '../src/lib/qr-transfer.mjs';
import { crc32 } from '../src/lib/morse.mjs';
const encoder = new TextEncoder();
const code = 'CDEFGHIJKLMNOPQRSTUVWXYZAB0123456789';
const edit = (frame, update) => 'QRT1|' + JSON.stringify({ ...JSON.parse(frame.slice(5)), ...update });
async function readAll(transfer, options = {}) {
  let result;
  const collector = createQrCollector({ ...options, onResult: value => { result = value; } });
  for (let i = 0; i < transfer.frameCount; i++) await collector.accept(transfer.frameAt(i));
  return { result, collector };
}
test('QR transfers preserve exact Unicode text and declare byte size', async () => {
  const text = 'Mixed Case\nሰላም 👋';
  const bytes = encoder.encode(text);
  const transfer = await createQrTransfer(bytes);
  assert.equal(transfer.manifest.s, bytes.length);
  assert.equal(transfer.manifest.c, Math.ceil(bytes.length / QR_CHUNK_BYTES));
  const { result } = await readAll(transfer);
  assert.equal(result.text, text); assert.deepEqual(result.bytes, bytes); assert.equal(result.verified, true);
});
test('missed chunks recover across loops; duplicates and reordering do not inflate progress', async () => {
  const bytes = Uint8Array.from({ length: 900 }, (_, i) => i % 256);
  const transfer = await createQrTransfer(bytes, { kind: 'file', name: 'data.bin', type: 'application/octet-stream' });
  const events = []; let result;
  const receiver = createQrCollector({ onProgress: value => events.push(value.receivedBytes), onResult: value => { result = value; } });
  await receiver.accept(transfer.frameAt(0));
  for (const i of [4, 1, 4, 3, 1, transfer.frameCount - 1]) await receiver.accept(transfer.frameAt(i));
  assert.equal(receiver.snapshot().received, 3); assert.equal(receiver.snapshot().receivedBytes, 660);
  assert.equal(result, undefined);
  await receiver.accept(transfer.frameAt(0)); assert.equal(receiver.snapshot().received, 3);
  await receiver.accept(transfer.frameAt(2));
  assert.deepEqual(result.bytes, bytes); assert.equal(result.name, 'data.bin'); assert.equal(result.type, 'application/octet-stream');
  assert.equal(receiver.snapshot().receivedBytes, 900); assert.equal(receiver.snapshot().complete, true);
  assert.ok(events.every(size => size <= 900));
});
test('late join can initialize at END and waits for START', async () => {
  const transfer = await createQrTransfer(encoder.encode('late join'));
  let result;
  const receiver = createQrCollector({ onResult: value => { result = value; } });
  assert.equal(await receiver.accept(transfer.frameAt(1)), 'waiting-start');
  await receiver.accept(transfer.frameAt(transfer.frameCount - 1));
  await receiver.accept(transfer.frameAt(1));
  assert.equal(receiver.snapshot().received, 1); assert.equal(result, undefined);
  await receiver.accept(transfer.frameAt(0)); assert.equal(result.text, 'late join');
});
test('all bytes without END cannot complete', async () => {
  const transfer = await createQrTransfer(encoder.encode('marker test'));
  const receiver = createQrCollector();
  await receiver.accept(transfer.frameAt(0)); await receiver.accept(transfer.frameAt(1));
  assert.equal(receiver.snapshot().receivedBytes, transfer.manifest.s); assert.equal(receiver.snapshot().complete, false);
  await receiver.accept(transfer.frameAt(2)); assert.equal(receiver.snapshot().complete, true);
});
test('shuffled QR payload restores files and text without transmitting the alphabet', async () => {
  const bytes = Uint8Array.from({ length: 700 }, (_, i) => i % 256);
  const transfer = await createQrTransfer(bytes, { kind: 'file', shuffle: true, code });
  assert.equal(transfer.manifest.sh, true); assert.equal(transfer.frameAt(1).includes(code), false);
  const { result } = await readAll(transfer, { shuffle: true, code });
  assert.deepEqual(result.bytes, bytes); assert.equal(result.shuffled, true);
});
test('wrong shuffle setting and wrong alphabet reject chunks without increasing progress', async () => {
  const transfer = await createQrTransfer(encoder.encode('HELLO 👋'), { shuffle: true, code });
  await assert.rejects(createQrCollector().accept(transfer.frameAt(0)), /Shuffle settings differ/);
  const wrong = createQrCollector({ shuffle: true, code: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
  await wrong.accept(transfer.frameAt(0));
  await assert.rejects(wrong.accept(transfer.frameAt(1)), /checksum|encoding|alphabet/i);
  assert.equal(wrong.snapshot().receivedBytes, 0);
});
test('damaged chunk is discarded; next loop can recover it', async () => {
  const transfer = await createQrTransfer(encoder.encode('recover me'));
  const receiver = createQrCollector();
  await receiver.accept(transfer.frameAt(0));
  await assert.rejects(receiver.accept(edit(transfer.frameAt(1), { crc: '00000000' })), /checksum/);
  assert.equal(receiver.snapshot().received, 0);
  await receiver.accept(transfer.frameAt(2)); await receiver.accept(transfer.frameAt(1));
  assert.equal(receiver.snapshot().complete, true);
});
test('whole checksum detects a corrupted chunk even with recomputed CRC, then permits loop recovery', async () => {
  const bytes = encoder.encode('complete integrity');
  const transfer = await createQrTransfer(bytes);
  const receiver = createQrCollector();
  await receiver.accept(transfer.frameAt(0));
  const bad = bytes.slice(); bad[0] ^= 1;
  const badTransfer = await createQrTransfer(bad);
  const raw = JSON.parse(badTransfer.frameAt(1).slice(5));
  await receiver.accept(edit(transfer.frameAt(1), { p: raw.p, crc: crc32(bad) }));
  await assert.rejects(receiver.accept(transfer.frameAt(2)), /Complete QR checksum failed/);
  assert.equal(receiver.snapshot().received, 0); assert.equal(receiver.snapshot().complete, false);
  await receiver.accept(transfer.frameAt(1)); assert.equal(receiver.snapshot().complete, true);
});
test('manifest binds metadata to SHA-256, not only payload bytes', async () => {
  const transfer = await createQrTransfer(encoder.encode('metadata'));
  const receiver = createQrCollector();
  await receiver.accept(edit(transfer.frameAt(0), { n: 'changed.txt' }));
  await receiver.accept(transfer.frameAt(1));
  await assert.rejects(receiver.accept(edit(transfer.frameAt(2), { n: 'changed.txt' })), /checksum failed/);
});
test('transfer IDs prevent mixing streams; reset allows a different transfer', async () => {
  const a = await createQrTransfer(encoder.encode('a')), b = await createQrTransfer(encoder.encode('b'));
  const receiver = createQrCollector();
  await receiver.accept(a.frameAt(0));
  assert.equal(await receiver.accept(b.frameAt(0)), 'other-transfer');
  assert.equal(await receiver.accept(b.frameAt(1)), 'other-transfer');
  assert.equal(receiver.snapshot().received, 0);
  receiver.reset(); for (let i = 0; i < b.frameCount; i++) await receiver.accept(b.frameAt(i));
  assert.equal(receiver.snapshot().complete, true);
});
test('reset during async verification cannot emit an obsolete result', async () => {
  const transfer = await createQrTransfer(encoder.encode('cancelled'));
  let count = 0; const receiver = createQrCollector({ onResult: () => count++ });
  await receiver.accept(transfer.frameAt(0)); await receiver.accept(transfer.frameAt(1));
  const pending = receiver.accept(transfer.frameAt(2)); receiver.reset(); await pending;
  assert.equal(count, 0); assert.equal(receiver.snapshot().manifest, null);
});
test('stopping verification preserves chunks and permits verification on resume', async () => {
  const transfer = await createQrTransfer(encoder.encode('resume verification'));
  let count = 0; const receiver = createQrCollector({ onResult: () => count++ });
  await receiver.accept(transfer.frameAt(0)); await receiver.accept(transfer.frameAt(1));
  const pending = receiver.accept(transfer.frameAt(2)); receiver.cancelVerification(); await pending;
  assert.equal(count, 0); assert.equal(receiver.snapshot().received, 1); assert.equal(receiver.snapshot().verifying, false);
  await receiver.accept(transfer.frameAt(0)); assert.equal(count, 1); assert.equal(receiver.snapshot().complete, true);
});
test('empty binary file completes with START and END only', async () => {
  const transfer = await createQrTransfer(new Uint8Array(), { kind: 'file', name: 'empty.bin' });
  assert.equal(transfer.frameCount, 2);
  const { result, collector } = await readAll(transfer);
  assert.equal(result.bytes.length, 0); assert.equal(collector.snapshot().complete, true);
});
test('1 MB boundary restores arbitrary bytes; oversized content is rejected', async () => {
  const bytes = Uint8Array.from({ length: QR_MAX_BYTES }, (_, i) => (i * 13) % 256);
  const transfer = await createQrTransfer(bytes, { kind: 'file' });
  const { result } = await readAll(transfer); assert.deepEqual(result.bytes, bytes);
  await assert.rejects(createQrTransfer(new Uint8Array(QR_MAX_BYTES + 1)), /1 MB/);
});
test('malformed and oversized manifests, bad chunk indexes, and changed manifests are rejected', async () => {
  const transfer = await createQrTransfer(encoder.encode('input validation'));
  const receiver = createQrCollector();
  assert.equal(await receiver.accept('https://example.com'), 'ignored');
  for (const update of [{ s: -1 }, { s: QR_MAX_BYTES + 1 }, { c: 100 }, { z: 0 }, { sh: 'yes' }, { h: 'x' }, { n: 'a'.repeat(121) }, { id: 'bad' }]) await assert.rejects(receiver.accept(edit(transfer.frameAt(0), update)));
  await assert.rejects(receiver.accept('QRT1|{'));
  await assert.rejects(receiver.accept('QRT1|' + 'x'.repeat(2001)));
  await receiver.accept(transfer.frameAt(0));
  await assert.rejects(receiver.accept(edit(transfer.frameAt(1), { i: 1 })), /index/);
  await assert.rejects(receiver.accept(edit(transfer.frameAt(2), { n: 'different.txt' })), /manifest changed/);
  assert.throws(() => transfer.frameAt(-1)); assert.throws(() => transfer.frameAt(transfer.frameCount));
});
test('conflicting valid-CRC duplicates cannot overwrite collected chunks', async () => {
  const transfer = await createQrTransfer(encoder.encode('aa'));
  const other = await createQrTransfer(encoder.encode('bb'));
  const receiver = createQrCollector(); await receiver.accept(transfer.frameAt(0)); await receiver.accept(transfer.frameAt(1));
  const frame = JSON.parse(other.frameAt(1).slice(5));
  await assert.rejects(receiver.accept(edit(transfer.frameAt(1), { p: frame.p, crc: frame.crc })), /Conflicting/);
  await receiver.accept(transfer.frameAt(2)); assert.equal(receiver.snapshot().complete, true);
});
test('QR preparation checks missing input and preserves selected file metadata', async () => {
  await assert.rejects(prepareQrInput({ inputKind: 'text', text: '' }), /Enter text/);
  await assert.rejects(prepareQrInput({ inputKind: 'file', file: null }), /Choose a file/);
  await assert.rejects(prepareQrInput({ inputKind: 'file', file: { size: QR_MAX_BYTES + 1 } }), /1 MB/);
  const bytes = encoder.encode('file content');
  const transfer = await prepareQrInput({ inputKind: 'file', file: { name: 'ሰላም.txt', type: '', size: bytes.length, arrayBuffer: async () => bytes.buffer } });
  const { result } = await readAll(transfer); assert.equal(result.name, 'ሰላም.txt'); assert.deepEqual(result.bytes, bytes);
  await assert.rejects(createQrTransfer(bytes, { shuffle: true, code: '' }), /shuffle|A–Z/i);
});
function raster(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' }), scale = 5, border = 4;
  const width = (qr.modules.size + border * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4); pixels.fill(255);
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) if (qr.modules.get(y, x)) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const offset = (((y + border) * scale + dy) * width + (x + border) * scale + dx) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  return jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' })?.data;
}
for (const shuffled of [false, true]) test(`generated START / DATA / END QR pixels decode and restore content (shuffle ${shuffled})`, async () => {
  const bytes = Uint8Array.from({ length: 510 }, (_, i) => i % 256);
  const transfer = await createQrTransfer(bytes, { kind: 'file', shuffle: shuffled, code });
  let result; const receiver = createQrCollector({ shuffle: shuffled, code, onResult: value => { result = value; } });
  for (let i = 0; i < transfer.frameCount; i++) {
    const decoded = raster(transfer.frameAt(i)); assert.equal(decoded, transfer.frameAt(i)); await receiver.accept(decoded);
  }
  assert.deepEqual(result.bytes, bytes);
});
