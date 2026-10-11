import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { base32Encode, base32Decode, crc32, makePacket, timeline } from '../src/lib/morse.mjs';
import { generateSecret, normalizeSecret, encryptPacket, decryptPacket, readEncryptedPacket, encryptedFramesIn } from '../src/lib/security.mjs';
import { prepareSecureText, prepareFile, createMessageDecoder, runAudioSelfTest } from '../src/lib/transfer.mjs';
import { TONE_OPTIONS } from '../src/lib/audio-options.mjs';
const utf8 = new TextEncoder();
const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const wrongCode = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
function deliver(decoder, wire) {
  let time = .5;
  for (const segment of timeline(wire)) { decoder.update({ on: segment.on, time }); time += segment.units * 1.2 / 30; }
  decoder.update({ on: false, time }); decoder.advance(time + 1);
}
function alteredPacket(frame, part) {
  const parts = frame.split(' ');
  const value = base32Decode(parts[part]); value[0] ^= 1; parts[part] = base32Encode(value);
  // A malicious sender can recompute CRC32. Only AEAD authenticates a packet.
  parts[5] = crc32(base32Decode(parts[2]), base32Decode(parts[3]), base32Decode(parts[4]));
  return parts.join(' ');
}
test('generated shared codes contain 160 random bits and normalize grouping/case', () => {
  const codes = new Set(Array.from({ length: 30 }, () => generateSecret()));
  assert.equal(codes.size, 30);
  for (const secret of codes) {
    assert.match(secret, /^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);
    assert.equal(base32Decode(normalizeSecret(secret)).length, 20);
    assert.equal(normalizeSecret(secret.toLowerCase().replaceAll('-', ' ')), normalizeSecret(secret));
  }
  for (const value of ['', '1234', code + 'A', '0'.repeat(32), 'A'.repeat(129)]) assert.throws(() => normalizeSecret(value), /shared code|shared Base32|Base32/);
});
test('encrypted Unicode and filenames unlock exactly; each preparation is randomized', async () => {
  const text = 'Meet at midnight 👋\nሰላም';
  const bytes = utf8.encode(text), metadata = { name: 'private-note.txt', type: 'text/plain' };
  const first = await encryptPacket(bytes, metadata, code), second = await encryptPacket(bytes, metadata, code);
  assert.notEqual(first, second); assert.notDeepEqual(readEncryptedPacket(first).salt, readEncryptedPacket(second).salt);
  assert.notDeepEqual(readEncryptedPacket(first).iv, readEncryptedPacket(second).iv);
  assert.equal(first.includes(code), false); assert.equal(first.includes(base32Encode(bytes)), false);
  assert.equal(first.includes(base32Encode(utf8.encode(metadata.name))), false);
  const restored = await decryptPacket(first, code.toLowerCase());
  assert.equal(restored.text, text); assert.equal(restored.name, metadata.name); assert.equal(restored.encrypted, true); assert.equal(restored.verified, true);
});
test('wrong codes, changed ciphertext, salt, and nonce release no plaintext even with a recomputed CRC', async () => {
  const frame = await encryptPacket(utf8.encode('PRIVATE'), undefined, code);
  await assert.rejects(decryptPacket(frame, wrongCode), /wrong or this packet was altered/);
  for (const part of [2, 3, 4]) await assert.rejects(decryptPacket(alteredPacket(frame, part), code), /wrong or this packet was altered/);
  assert.equal((await decryptPacket(frame, code)).text, 'PRIVATE');
});
test('encrypted framing rejects damage, malformed encodings, huge inputs, and plaintext downgrade', async () => {
  const frame = await encryptPacket(utf8.encode('Hi'), undefined, code), parts = frame.split(' ');
  parts[5] = parts[5] === '00000000' ? '00000001' : '00000000';
  assert.throws(() => readEncryptedPacket(parts.join(' ')), /checksum failed/);
  assert.throws(() => readEncryptedPacket(frame.replace('MTE1', 'MTE2')), /Incomplete/);
  assert.throws(() => readEncryptedPacket('X'.repeat(9801)), /size limit/);
  assert.throws(() => readEncryptedPacket(frame.replace(frame.split(' ')[2], 'A')), /metadata/);
  assert.throws(() => readEncryptedPacket(frame.replace(frame.split(' ')[3], '0'.repeat(20))), /alphabet/);
  assert.equal(encryptedFramesIn('noise ' + frame + ' tail')[0], frame);
  const decoder = createMessageDecoder({ wpm: 30, mode: 'secure' });
  deliver(decoder, makePacket(utf8.encode('PLAINTEXT'))); assert.equal(decoder.getResult(), null);
  decoder.reset(); deliver(decoder, frame);
  const locked = decoder.getResult(); assert.equal(locked.locked, true); assert.equal(locked.text, undefined); assert.equal(locked.bytes, undefined);
  assert.equal((await decryptPacket(locked.frame, code)).text, 'Hi');
});
test('secure file preparation supports arbitrary bytes, empty files, and original 2 KB limit', async () => {
  for (const length of [0, 256, 2048]) {
    const bytes = Uint8Array.from({ length }, (_, index) => index % 256);
    const packet = await prepareFile({ size: length, name: 'secrets.bin', type: 'application/octet-stream', arrayBuffer: async () => bytes.buffer }, 'secure', code);
    assert.deepEqual((await decryptPacket(packet.wire, code)).bytes, bytes); assert.equal(packet.encrypted, true);
  }
  await assert.rejects(prepareSecureText('x'.repeat(2049), code), /2 KB/);
  await assert.rejects(encryptPacket(new Uint8Array(2049), undefined, code), /2 KB/);
  await assert.rejects(encryptPacket(new Uint8Array(), { name: 'x'.repeat(121) }, code), /120/);
  await assert.rejects(encryptPacket(new Uint8Array(), { name: '\x00'.repeat(120), type: '\x00'.repeat(120) }, code), /limit/);
});
test('encryption interoperates with independent Web Crypto derivation using the documented fixed suite', async () => {
  const frame = await encryptPacket(utf8.encode('Interoperability'), undefined, code);
  const { salt, iv, ciphertext } = readEncryptedPacket(frame);
  const context = utf8.encode('Morse Transfer / MTE1 / AES-256-GCM / HKDF-SHA-256');
  const material = await webcrypto.subtle.importKey('raw', base32Decode(code), 'HKDF', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: context }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: context, tagLength: 128 }, key, ciphertext);
  assert.equal(new TextDecoder().decode(plaintext), makePacket(utf8.encode('Interoperability')));
});
test('sampled Morse audio carries encrypted content and only authenticated plaintext reaches self-test results', async () => {
  const results = [];
  const result = await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode: 'secure', code, onResult: value => results.push(value) });
  assert.equal(result.text, 'Hi 👋'); assert.equal(result.encrypted, true); assert.equal(results.length, 1); assert.equal(results[0].locked, false);
  let called = false;
  assert.equal(await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode: 'secure', code, cancelled: () => true, onResult: () => { called = true; } }), null);
  assert.equal(called, false);
});

test('secure browser self-test can leave a packet locked for the real unlock workflow', async () => {
  const results = [];
  const result = await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode: 'secure', code, keepLocked: true, onResult: value => results.push(value) });
  assert.equal(result.text, 'Hi 👋'); assert.equal(results.length, 1); assert.equal(results[0].locked, true);
  assert.equal(results[0].text, undefined); assert.equal((await decryptPacket(results[0].frame, code)).text, result.text);
});

for (const frequency of TONE_OPTIONS) test(`80 WPM encrypted audio self-test authenticates at ${frequency} Hz`, async () => {
  const result = await runAudioSelfTest({ wpm: 80, frequency, threshold: .01, mode: 'secure', code });
  assert.equal(result.text, 'Hi 👋'); assert.equal(result.encrypted, true); assert.equal(result.verified, true);
});
