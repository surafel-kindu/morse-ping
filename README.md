# Morse Transfer

**Messages through sound. Built with React and Vite.**

Send letters directly as Morse beeps, or transfer a tiny file to another device using its microphone. Processing stays in the browser; the app has no account system, upload endpoint, or application backend.

| Direct text | File / exact Unicode |
| --- | --- |
| Letters, numbers, supported punctuation → Morse → sound → text | Original bytes → Base32 frame → Morse → sound → verified original |
| Fast, live uppercase text | Preserves files, Unicode, case, emoji, and formatting |
| No checksum | CRC32 corruption detection; maximum 2 KB |

## Quick start

Use **Node.js 22.12 or newer**. This project includes `.nvmrc` for Node 22.22.2.

```sh
cd "/Users/surafelmulaw/Documents/Afroawi Projects/Morse Transfer"
nvm use                 # If needed, run: nvm install
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally `http://localhost:5173`. If that port is busy, Vite prints another available port. `npm start` is an alias for the development server. If you do not use nvm, install a compatible Node version and skip the nvm command.

> Stop the previous vanilla development server before restarting this React version. The old `server.mjs` entry point has been replaced by Vite. Do not open `index.html` directly.

## Test on your phone with HTTPS

Phone browsers block microphone access on ordinary HTTP LAN addresses. For a temporary HTTPS address, install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) on your Mac with Homebrew:

```sh
brew install cloudflared
```

In the project folder, start a production preview in the first terminal:

```sh
nvm use
npm run build
npm run preview -- --port 4173 --strictPort
```

Keep it running. In a second terminal, start the tunnel:

```sh
cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost
```

Open the printed **`https://…trycloudflare.com`** URL in Safari or Chrome on your phone, press **Start listening**, and allow the microphone. Keep both terminals running. Stop each with **Ctrl+C** when finished.

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) need no Cloudflare account or domain. Anyone with the URL can open the preview; the address changes on restart and stops working when the tunnel stops. This setup is for temporary testing. It gives the phone HTTPS access to the app; Morse still travels through the speaker and microphone, so keep the devices near each other.

See [phone setup and tunnel troubleshooting](docs/getting-started.md#temporary-https-with-cloudflared) for other platforms, port changes, and rebuilding after edits.

## Your first transfer

1. Open the app on both devices. Phones need an **HTTPS-hosted build** for microphone access; use the Cloudflare tunnel above for testing.
2. Match **30 WPM** and **700 Hz**. Use **Direct text** on the sender and **Text · letters & numbers** on the receiver.
3. Press **Start listening** on the receiver and allow microphone access.
4. Enter `HELLO 123` on the sender and press **Play Morse sound**.
5. Read the letters as they arrive, then stop listening.

For a file or exact Unicode text, choose **Exact transfer** on the sender and **File / exact Unicode text** on the receiver. Wait for **CHECKSUM OK** before downloading the original.

The app’s **Read the guide** link opens a built-in field guide with mode selection, setup steps, and troubleshooting.

## Documentation

| Guide | What it covers |
| --- | --- |
| [Getting started](docs/getting-started.md) | Installation, scripts, both modes, two-device setup, Cloudflare tunnels, HTTPS deployment |
| [Architecture](docs/architecture.md) | React components, hooks, audio sessions, data flow, resource cleanup |
| [Transfer protocol](docs/protocol.md) | Morse timing, Base32 framing, metadata, checksum, decoder rules |
| [Troubleshooting](docs/troubleshooting.md) | Microphone access, noise, missed tones, mode mismatch, slow transfers |
| [Development](docs/development.md) | Source map, tests, build checks, extending the app |

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` / `npm start` | Run React with Vite and hot reload |
| `npm test` | Run protocol, sampled-audio, receiver-mode, and worklet integration tests |
| `npm run build` | Create a production static site in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run verify:build` | Verify production HTML and the bundled AudioWorklet |
| `npm run check` | Run tests, build, and verify production assets |

## Project layout

```text
src/
  App.jsx                      App state and composition
  main.jsx                     React root with Strict Mode
  components/                  Sender, receiver, settings, field guide
  hooks/                       Transfer preparation and audio lifecycle
  lib/morse.mjs                Alphabet, timing, Base32, CRC32, packet parser
  lib/transfer.mjs             Preparation, receiver modes, synthetic self-test
  audio/sessions.mjs           Playback and microphone resource ownership
  audio/tone-detector.mjs      Shared signal detector
  audio/receiver-worklet.mjs   Microphone processing off the UI thread
  styles.css                   Responsive visual design

docs/                          User and developer documentation
tests/                         Node tests and isolated AudioWorklet harness
vite.config.mjs                React build and ES-module worklet bundling
```

## Performance and limits

At 30 WPM, plain `HELLO WORLD` takes about **4.7 seconds**. A representative 1 KiB exact file takes about **14 minutes**, including framing; duration varies with its contents and metadata. These are calculated transmission times, not measured acoustic throughput. The app shows the duration for your input.

Start at 20–30 WPM. Fifty WPM is experimental. Exact payloads are capped at 2,048 bytes. Sender and receiver must agree on mode, speed, and tone. Room noise, echo, clipping, browser audio processing, and background suspension affect reception.

CRC32 detects accidental corruption; it does not correct errors, authenticate the sender, or encrypt the audio. There is no acknowledgement, chunking, automatic retry, or resume. Resend a failed exact transfer from the beginning.

## Validation

Automated checks cover exact Unicode and arbitrary-byte recovery, direct text, boundaries, corruption, sampled audio at 10–50 WPM with modest noise and jitter, and worklet processing without DOM globals. The browser self-test uses generated audio through the same detector and decoder. It does not exercise a physical speaker/microphone pair. Real two-device acoustic reception remains a device-specific test.

## References

- [React effects and cleanup](https://react.dev/reference/react/useEffect)
- [Vite setup and Node requirements](https://vite.dev/guide/)
- [International Morse timing](https://morsecode.world/international/timing/)
- [Microphone secure contexts and permission](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

An alternative Morse library is [morse-pro](https://github.com/scp93ch/morse-pro), whose maintainer links to its GitLab home. This app keeps its Morse and framing implementation small and independent of that library.
