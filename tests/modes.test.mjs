import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareText, prepareFile, createMessageDecoder, runAudioSelfTest, formatTime } from '../src/lib/transfer.mjs';
import { TONE_OPTIONS } from '../src/lib/audio-options.mjs';
import { readPacket, timeline } from '../src/lib/morse.mjs';
function deliver(decoder, wire, wpm = 30) {
  let time = .5;
  for (const segment of timeline(wire)) { decoder.update({ on: segment.on, time }); time += segment.units * 1.2 / wpm; }
  decoder.update({ on: false, time }); decoder.advance(time + 1);
}
test('direct text has no byte frame; exact text retains original formatting', () => {
  const plain = prepareText('Hello 123\nworld');
  assert.equal(plain.wire, 'HELLO 123 WORLD'); assert.equal(plain.bytes, null);
  const text = 'Hi 👋\nሰላም'; assert.equal(readPacket(prepareText(text, 'exact').wire).text, text);
});
test('file preparation preserves bytes and rejects oversize before reading', async () => {
  const data = Uint8Array.from([0, 255, 65, 10]);
  const packet = await prepareFile({ name: 'tiny.bin', type: 'application/octet-stream', size: data.length, arrayBuffer: async () => data.buffer });
  assert.deepEqual(readPacket(packet.wire).bytes, data);
  let read = false;
  await assert.rejects(prepareFile({ size: 2049, arrayBuffer: async () => { read = true; } }), /2 KB/);
  assert.equal(read, false);
});
test('direct receiver emits incremental uppercase text without claiming verification', () => {
  const results = [];
  const decoder = createMessageDecoder({ wpm: 30, mode: 'plain', onResult: result => results.push(result) });
  deliver(decoder, 'HELLO 123');
  assert.equal(results[0].text, 'H'); assert.equal(decoder.getResult().text, 'HELLO 123'); assert.equal(decoder.getResult().verified, false);
  decoder.reset(); assert.equal(decoder.getResult(), null);
});
test('exact receiver withholds result until complete frame and rejects corruption', () => {
  const errors = [], results = [];
  const decoder = createMessageDecoder({ wpm: 30, mode: 'exact', onError: error => errors.push(error.message), onResult: result => results.push(result) });
  const packet = prepareText('Case preserved 👋', 'exact').wire;
  deliver(decoder, packet.replace(/ [A-F0-9]{8} END$/, ' 00000000 END'));
  assert.equal(results.length, 0); assert.match(errors[0], /Checksum/);
  decoder.reset(); deliver(decoder, packet);
  assert.equal(results.length, 1); assert.equal(results[0].verified, true); assert.equal(results[0].text, 'Case preserved 👋');
});
for (const mode of ['plain', 'exact']) test(`generated-audio integration restores ${mode} receiver mode`, async () => {
  const result = await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode });
  assert.equal(result.text, mode === 'plain' ? 'HELLO 123' : 'Hi 👋'); assert.equal(result.verified, mode === 'exact');
});
test('self-test cancellation emits no later results', async () => {
  let count = 0;
  assert.equal(await runAudioSelfTest({ wpm: 30, frequency: 700, threshold: .01, mode: 'exact', cancelled: () => true, onResult: () => count++ }), null);
  assert.equal(count, 0);
});
test('time labels round across minute boundary', () => { assert.equal(formatTime(59.5), '1m 0s'); assert.equal(formatTime(61.1), '1m 2s'); });

for (const frequency of TONE_OPTIONS) for (const mode of ['plain', 'exact']) test(`80 WPM self-test restores ${mode} mode at ${frequency} Hz`, async () => {
  const result = await runAudioSelfTest({ wpm: 80, frequency, threshold: .01, mode });
  assert.equal(result.text, mode === 'plain' ? 'HELLO 123' : 'Hi 👋');
});
