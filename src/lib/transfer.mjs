import { MAX_BYTES, TimingDecoder, ToneDetector, normalizePlain, makePacket, readPacket, framesIn, timeline, toMorse } from './morse.mjs';
const encoder = new TextEncoder();

function prepared(wire, plain, bytes) {
  const segments = timeline(wire);
  return { wire, plain, bytes, segments, morse: toMorse(wire), units: segments.reduce((sum, segment) => sum + segment.units, 0), count: plain ? wire.length : bytes.length };
}
export function prepareText(text, mode = 'plain') {
  if (!text.length) throw new Error('Enter a message to prepare a transfer.');
  if (mode === 'plain') return prepared(normalizePlain(text), true, null);
  if (mode !== 'exact') throw new Error('Unknown transfer mode.');
  const bytes = encoder.encode(text);
  return prepared(makePacket(bytes), false, bytes);
}
export async function prepareFile(file) {
  if (!file) throw new Error('Choose a file to prepare a transfer.');
  if (file.size > MAX_BYTES) throw new Error('Choose a file up to 2 KB (2,048 bytes).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return prepared(makePacket(bytes, { kind: 'file', name: file.name, type: file.type || 'application/octet-stream' }), false, bytes);
}
export function createMessageDecoder({ wpm, mode, onSignal = () => {}, onResult = () => {}, onError = () => {} }) {
  if (!['plain', 'exact'].includes(mode)) throw new Error('Unknown receiver mode.');
  let result = null;
  const seen = new Set();
  const decoder = new TimingDecoder(wpm, (_character, characters, morse) => {
    onSignal({ characters, morse });
    if (mode === 'plain') {
      const text = characters.trimEnd();
      // Bytes are created only for the downloadable .txt file. They are not
      // encoded into the sound in direct-text mode.
      result = { kind: 'text', name: 'message.txt', type: 'text/plain', text, bytes: encoder.encode(text), verified: false };
      onResult(result);
      return;
    }
    for (const frame of framesIn(characters)) {
      if (seen.has(frame)) continue;
      seen.add(frame);
      if (seen.size > 20) seen.delete(seen.values().next().value);
      try { result = { ...readPacket(frame), verified: true }; onResult(result); }
      catch (error) { onError(error); }
    }
  });
  return {
    update: event => decoder.update(event.on, event.time),
    advance: time => decoder.advance(time),
    flush: () => decoder.flush(),
    reset: () => { decoder.reset(); seen.clear(); result = null; },
    getResult: () => result,
  };
}
export async function runAudioSelfTest({ wpm, frequency, threshold, mode, onSignal, onResult, onError, cancelled = () => false }) {
  const expected = mode === 'plain' ? 'HELLO 123' : 'Hi 👋';
  const wire = mode === 'plain' ? expected : makePacket(encoder.encode(expected), { name: '', type: '' });
  const sampleRate = 12000, unit = 1.2 / wpm;
  const decoder = createMessageDecoder({ wpm, mode, onSignal, onResult, onError });
  const detector = new ToneDetector(sampleRate, frequency, threshold, decoder.update);
  let offset = 0, segmentIndex = 0;
  for (const segment of [{ on: false, units: 8 }, ...timeline(wire), { on: false, units: 8 }]) {
    if (cancelled()) return null;
    const count = Math.round(segment.units * unit * sampleRate), block = new Float32Array(count);
    if (segment.on) for (let i = 0; i < count; i++) {
      const ramp = Math.min(1, i / (sampleRate * .003), (count - 1 - i) / (sampleRate * .003));
      block[i] = .25 * ramp * Math.sin(2 * Math.PI * frequency * (offset + i) / sampleRate);
    }
    detector.push(block); offset += count;
    if (++segmentIndex % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  decoder.advance(offset / sampleRate + unit * 8);
  const result = decoder.getResult();
  if (!result || result.text !== expected) throw new Error('Self-test failed to restore the generated message.');
  return result;
}
export function formatTime(seconds) {
  const rounded = Math.ceil(seconds);
  return rounded < 60 ? `${rounded} sec` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}
