# Getting started

[← Documentation home](../README.md#documentation)

## Install and run

The development toolchain needs Node.js 22.12+. Use the included `.nvmrc` to select 22.22.2 with nvm:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Run these commands from the project folder. Open the URL printed in the terminal. Vite normally starts on port 5173 and chooses another free port if necessary. To choose a port explicitly:

```sh
npm run dev -- --port 5174
```

If an older copy of Morse Transfer is already running, stop its terminal process first. Refreshing the old vanilla server is not enough to load React.

## Choose matching modes

| Sender | Receiver “Listen as” | Use it for |
| --- | --- | --- |
| Text → Direct text | Text · letters & numbers | Ordinary messages using A–Z, 0–9, and supported punctuation |
| Text → Exact transfer | File / exact Unicode text | Emoji, Ethiopic text, mixed case, newlines, exact formatting |
| File | File / exact Unicode text | Any file type up to 2,048 bytes |

Direct text goes straight to Morse. The app does not wrap it in a binary frame. Received text is uppercase and repeated whitespace becomes one space. Unsupported characters produce an error before playback. A downloadable direct-text result is saved as a UTF-8 `.txt` file; this encoding is for the download, not for the Morse transmission.

Exact mode encodes the original bytes into Morse-compatible Base32 characters. Metadata and a checksum let the receiver reconstruct the original content. Files automatically use exact mode. Switching back to Text preserves your previous text encoding choice.

## Speaker-to-microphone workflow

1. Put the devices near each other in a quiet room. Use moderate speaker volume to avoid clipping.
2. Set both to the same mode, frequency, and WPM. Try 700 Hz and 30 WPM first.
3. On the receiver, press **Start listening**, allow microphone access, and leave the page active.
4. On the sender, enter text or choose a tiny file. Check the transmission estimate.
5. Press **Play Morse sound**. Direct text appears incrementally in the received result; live Morse and decoded characters are available in the expandable signal section.
6. For exact mode, wait for **CHECKSUM OK**, then use **Download original**. An incomplete or corrupt frame is not accepted as an original file.
7. Press **Stop** on the receiver to release the microphone.

Playback, listening, and the synthetic self-test are mutually exclusive on a single app instance. Stop the active action before changing audio settings or receiver mode. Cancelling a pending microphone request prevents a subsequently granted stream from staying active.

## Local self-test

Choose either receiver mode and press **Run audio self-test**. Text mode restores `HELLO 123`; exact mode restores `Hi 👋` with a valid checksum. The signal is synthesized and decoded in memory. This checks application logic without requesting microphone access or playing sound.

## Build and use on phones

```sh
npm run check
npm run preview
```

`npm run build` produces `dist/`. Upload the **whole contents of `dist/`**, including `assets/`, to a trusted HTTPS static host. No application backend or server-side upload handler is required. This project has not been published automatically.

Vite bundles the microphone worklet as a separate ES module with a generated asset URL. Do not manually rename or omit its emitted asset. The build uses relative asset paths so it can be served at the root or under a subdirectory. Serve HTML as HTML and JavaScript assets as JavaScript, and preserve their paths.

The local dev/preview server binds to loopback by default. `--host 0.0.0.0` can make a dev server reachable on a LAN, but **ordinary HTTP on a LAN still does not enable phone microphone access**. Use a trusted HTTPS host or an HTTPS development proxy. Do not disable browser security or bypass certificate warnings.

## Privacy

Selected files, decoded content, and microphone samples stay in the browser. No analytics or upload endpoint is built in. The acoustic transmission itself is audible to nearby devices and people and is not encrypted. Stopping reception or leaving the page releases audio resources. Host/server access logging, if any, is controlled by your chosen hosting provider.
