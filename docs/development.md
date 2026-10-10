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
| `src/lib/transfer.mjs` | Changing direct/exact preparation, message interpretation, or synthetic self-test |

## Checks

```sh
npm test
npm run build
npm run verify:build
# Or all checks:
npm run check
```

Tests use Node’s built-in test runner. Production verification runs that same harness against the emitted worklet, checking that bundling preserves its processing behavior. The isolated AudioWorklet harness runs in a subprocess with VM modules enabled so the processor executes without browser DOM globals. Synthetic audio tests feed actual samples through the same detector used by the microphone worklet.

Coverage includes Unicode and arbitrary-byte round trips; direct text without a byte frame; incremental text reception; exact-mode corruption rejection; empty/oversize files; Base32 boundaries; CRC32; Morse timing; 10–50 WPM with modest generated noise/jitter; supported pitches; off-frequency rejection; self-test cancellation; and worklet registration/silent output.

## Browser verification

Use both the development server and the production preview after a build:

```sh
npm run preview -- --port 4174
```

Check direct text → Text mode and exact Unicode → File / exact Unicode mode with the in-app self-test. Also check file selection, validation errors, keyboard tabs, playback start/stop, receiver cancellation, the field guide, and narrow-screen layout.

For physical testing, open an HTTPS build on two devices, start reception first, and use tiny test messages. Record device/browser names, WPM, frequency, distance, threshold, and the success/error rate. Synthetic checks should never be reported as measured speaker-to-microphone reliability.

## Production worklet

Vite builds the worklet separately through a `?worker&url` import. Its output format must remain `es`. Keep the URL import and `audioWorklet.addModule` together; do not replace them with a hardcoded path that only works in development. Upload the full `dist/` tree.

The detector module must stay free of DOM-dependent initialization. The worklet cannot import the codec module, which initializes text encoding utilities, or React.

## Extending safely

- Preserve existing MT1 field meanings for compatibility; use a new version marker for incompatible wire changes.
- Add integrity checks for transport changes, including malformed/truncated frames and random binary payloads.
- Keep audio timing on the audio clock rather than UI timers.
- Release resources on stop, error, cancellation, unmount, and page exit. Guard callbacks from obsolete sessions.
- Keep received content as text and downloads. Do not render incoming HTML or execute incoming files.
- Chunking, acknowledgement, retries, adaptive speed/pitch, and error correction are possible next steps. They are not implemented in the current prototype.
