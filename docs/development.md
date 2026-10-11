# Development

[← Documentation home](../README.md#documentation)

## Toolchain

React and React DOM render the UI. Vite and its React plugin serve and bundle it. Dependency versions are recorded in `package.json` and pinned by `package-lock.json`; use `npm ci` for reproducible installation. Node 22.22.2 is specified in `.nvmrc`, with Node 22.12+ required by the project.

```sh
nvm use
npm ci
npm run dev
```

There are no runtime calls to a backend, CDN fonts, or an external Morse service. Production code and the worklet are delivered as static build assets.

## Source map

| File / directory | Change here when… |
| --- | --- |
| `src/components/` | Adjusting user flows, controls, or documentation in the page |
| `src/styles.css` | Updating the responsive visual design |
| `src/hooks/usePreparedTransfer.js` | Changing input preparation and asynchronous file-read handling |
| `src/hooks/useAudioTransfer.js` | Changing action orchestration, state, or session ownership |
| `src/audio/sessions.mjs` | Changing browser playback or microphone integration |
| `src/audio/tone-detector.mjs` | Changing signal detection, windows, thresholds, or hysteresis |
| `src/audio/receiver-worklet.mjs` | Changing worklet channel handling or processor integration |
| `src/lib/morse.mjs` | Changing Morse symbols, timings, Base32, CRC32, or packet validation |
| `src/lib/audio-options.mjs` | Changing the bounded speed/tone presets offered in the UI |
| `src/lib/security.mjs` | Changing alphabet validation, permutation generation, mapping swaps, or substitution |
| `src/lib/transfer.mjs` | Changing direct/exact preparation with optional shuffle, message interpretation, or synthetic self-test |

## Checks

```sh
npm test
npm run build
npm run verify:build
# Or all checks:
npm run check
```

Tests use Node’s built-in test runner. Production verification runs that same harness against the emitted worklet, checking that bundling preserves its processing behavior. The isolated AudioWorklet harness runs in a subprocess with VM modules enabled so the processor executes without browser DOM globals. Synthetic audio tests feed actual samples through the same detector used by the microphone worklet.

Coverage includes Unicode and arbitrary-byte round trips; direct text without a byte frame; incremental text reception; exact-mode corruption rejection; empty/oversize files; Base32 boundaries; CRC32; Morse timing; 10–80 WPM with modest generated noise/jitter; all tone presets through 4,000 Hz; higher-speed/tone combinations at 12/44.1/48 kHz sample rates; direct/exact/shuffled self-tests at 80 WPM; off-frequency rejection; self-test cancellation; worklet registration/silent output; shuffled Unicode/binary recovery; alphabet validation; reversible mapping edits; unchanged wire character counts; and garbled direct text with a wrong alphabet.

## Browser verification

Use both the development server and the production preview after a build:

```sh
npm run preview -- --port 4174
```

First verify character shuffle: generate and copy an alphabet, edit `A → C`, and confirm the editor swaps another assignment to retain a permutation. Run both receiver-mode self-tests with shuffle on. Confirm direct text restores live without an unlock button, exact mode shows CHECKSUM OK, and Forget clears the code/result while leaving shuffle enabled. Invalid or missing alphabets must prevent shuffled transmission and reception. Switch shuffle off and check both modes again. Also check file selection, keyboard tabs, playback start/stop, receiver cancellation, the field guide, and narrow-screen layout.

For temporary phone testing, use the [cloudflared HTTPS tunnel setup](getting-started.md#temporary-https-with-cloudflared) to serve the production preview. Rebuild after source edits; preview does not provide development hot reload.

For physical testing, open an HTTPS build on two devices, start reception first, and use tiny test messages. Record device/browser names, WPM, frequency, distance, threshold, and the success/error rate. For higher settings, follow [higher-speed/tone testing](getting-started.md#try-higher-speeds-and-tones) and include 60, 70, and 80 WPM with tones above 900 Hz. The isolated worklet harness tests 80 WPM at 700 and 4,000 Hz, including the emitted production bundle. Synthetic checks should never be reported as measured speaker-to-microphone reliability.

## Production worklet

Vite builds the worklet separately through a `?worker&url` import. Its output format must remain `es`. Keep the URL import and `audioWorklet.addModule` together; do not replace them with a hardcoded path that only works in development. Upload the full `dist/` tree.

The detector module must stay free of DOM-dependent initialization. The worklet cannot import the codec module, which initializes text encoding utilities, or React.

## Character shuffle implementation

See [character shuffle](security.md) for examples and limits and [wire semantics](protocol.md#character-shuffle). Keep the alphabet bijective, apply substitution only to prepared Morse-compatible text, and reverse it before interpreting receiver modes. Punctuation and spaces pass through unchanged. Generated alphabets use unbiased Fisher–Yates swaps with `crypto.getRandomValues`; randomness does not make fixed substitution strong encryption. Do not describe shuffle or CRC32 as authentication. Do not log or persist shared alphabets.

## Extending safely

- Preserve existing MT1 field meanings for compatibility; use a new version marker for incompatible wire changes.
- Add integrity checks for transport changes, including malformed/truncated frames and random binary payloads.
- Keep audio timing on the audio clock rather than UI timers.
- Release resources on stop, error, cancellation, unmount, and page exit. Guard callbacks from obsolete sessions.
- Keep received content as text and downloads. Do not render incoming HTML or execute incoming files.
- Chunking, acknowledgement, retries, adaptive speed/pitch, and error correction are possible next steps. They are not implemented in the current prototype.
