import test from 'node:test';
import assert from 'node:assert/strict';
import { SHUFFLE_ALPHABET, normalizeShuffleCode, createShuffleMapping, generateShuffleCode, shuffleCharacters, unshuffleCharacters, swapShuffleMapping } from '../src/lib/security.mjs';
import { prepareText, prepareFile, createMessageDecoder, runAudioSelfTest } from '../src/lib/transfer.mjs';
import { TONE_OPTIONS } from '../src/lib/audio-options.mjs';
import { timeline, readPacket } from '../src/lib/morse.mjs';
const code = 'CDEFGHIJKLMNOPQRSTUVWXYZAB0123456789';
function deliver(decoder, wire) {
  let time = .5;
  for (const segment of timeline(wire)) { decoder.update({ on: segment.on, time }); time += segment.units * 1.2 / 30; }
  decoder.update({ on: false, time }); decoder.advance(time + 1);
}
test('shared alphabet validates a full reversible permutation and ignores spacing/case', () => {
  assert.equal(normalizeShuffleCode(code.toLowerCase().match(/.{4}/g).join('-')), code);
  for (const invalid of ['', '1234', code + 'A', 'A'.repeat(36), code.replace('9', '!'), 'A'.repeat(129)]) assert.throws(() => normalizeShuffleCode(invalid), /alphabet|exactly once/);
  const mapping = createShuffleMapping(code);
  assert.equal(mapping.forward.A, 'C'); assert.equal(mapping.reverse.C, 'A');
});
test('generated alphabets contain every source character exactly once', () => {
  const codes = new Set(Array.from({ length: 20 }, generateShuffleCode));
  assert.equal(codes.size, 20);
  for (const value of codes) assert.equal([...normalizeShuffleCode(value)].sort().join(''), [...SHUFFLE_ALPHABET].sort().join(''));
});
test('substitution is one character in, one character out, including digits; punctuation stays unchanged', () => {
  assert.equal(shuffleCharacters('HELLO 123!', code), 'JGNNQ 123!');
  const all = `${SHUFFLE_ALPHABET} .,?'!/()&:;=+-_\"@`;
  const shuffled = shuffleCharacters(all, [...SHUFFLE_ALPHABET].reverse().join(''));
  assert.equal(shuffled.length, all.length); assert.equal(unshuffleCharacters(shuffled, [...SHUFFLE_ALPHABET].reverse().join('')), all);
  assert.throws(() => shuffleCharacters('👋', code), /Exact transfer/);
});
test('editing A to C swaps assignments without duplicates and preserves all round trips', () => {
  const changed = swapShuffleMapping(SHUFFLE_ALPHABET, 'A', 'C');
  const mapping = createShuffleMapping(changed);
  assert.equal(mapping.forward.A, 'C'); assert.equal(mapping.forward.C, 'A');
  assert.equal(unshuffleCharacters(shuffleCharacters(SHUFFLE_ALPHABET, changed), changed), SHUFFLE_ALPHABET);
  assert.equal(swapShuffleMapping(changed, 'A', 'C'), changed);
  assert.throws(() => swapShuffleMapping(changed, 'AB', 'C'), /letter or number/);
});
test('direct shuffled preparation adds no frame or byte payload and the receiver restores live letters', () => {
  const packet = prepareText('Hello 123!\nworld', 'plain', { shuffle: true, code });
  assert.equal(packet.wire, 'JGNNQ 123! YQTNF'); assert.equal(packet.bytes, null); assert.equal(packet.shuffled, true);
  assert.equal(packet.count, 'HELLO 123! WORLD'.length);
  const results = [];
  const decoder = createMessageDecoder({ wpm: 30, mode: 'plain', shuffle: true, code, onResult: result => results.push(result) });
  deliver(decoder, packet.wire);
  assert.equal(results[0].text, 'H'); assert.equal(decoder.getResult().text, 'HELLO 123! WORLD'); assert.equal(decoder.getResult().verified, false);
  const wrong = createMessageDecoder({ wpm: 30, mode: 'plain', shuffle: true, code: SHUFFLE_ALPHABET });
  deliver(wrong, packet.wire); assert.notEqual(wrong.getResult().text, decoder.getResult().text); assert.equal(wrong.getResult().verified, false);
});
test('shuffling exact Unicode and file frames preserves checksum, metadata, empty files, and 2 KB payloads', async () => {
  const text = 'Hi 👋\nሰላም';
  const packet = prepareText(text, 'exact', { shuffle: true, code });
  assert.equal(readPacket(unshuffleCharacters(packet.wire, code)).text, text);
  const decoder = createMessageDecoder({ wpm: 30, mode: 'exact', shuffle: true, code });
  deliver(decoder, packet.wire); assert.equal(decoder.getResult().text, text); assert.equal(decoder.getResult().verified, true);
  for (const length of [0, 256, 2048]) {
    const bytes = Uint8Array.from({ length }, (_, index) => index % 256);
    const file = await prepareFile({ size: length, name: 'tiny.bin', type: 'application/octet-stream', arrayBuffer: async () => bytes.buffer }, { shuffle: true, code });
    const result = readPacket(unshuffleCharacters(file.wire, code));
    assert.deepEqual(result.bytes, bytes); assert.equal(result.name, 'tiny.bin');
    assert.equal(file.wire.length, unshuffleCharacters(file.wire, code).length);
  }
});
test('shuffle requires a valid alphabet before preparing or starting reception', () => {
  assert.throws(() => prepareText('HI', 'plain', { shuffle: true, code: '' }), /Generate/);
  assert.throws(() => createMessageDecoder({ wpm: 30, mode: 'plain', shuffle: true, code: '' }), /Generate/);
  assert.equal(prepareText('HI', 'plain').wire, 'HI');
});
for (const frequency of TONE_OPTIONS) for (const mode of ['plain', 'exact']) test(`80 WPM shuffled ${mode} audio restores at ${frequency} Hz`, async () => {
  const result = await runAudioSelfTest({ wpm: 80, frequency, threshold: .01, mode, shuffle: true, code });
  assert.equal(result.text, mode === 'plain' ? 'HELLO 123' : 'Hi 👋'); assert.equal(result.shuffled, true); assert.equal(result.verified, mode === 'exact');
});
test('cancelled shuffled audio self-test does not emit a result', async () => {
  let called = false;
  assert.equal(await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode: 'plain', shuffle: true, code, cancelled: () => true, onResult: () => { called = true; } }), null);
  assert.equal(called, false);
});
