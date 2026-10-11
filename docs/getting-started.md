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

## Choose a transfer method

The top controls select **Morse sound** or **Camera & QR**. Morse uses audio; QR uses the screen and camera, supports exact text/files up to 1 MB, and automatically collects missed chunks across loops. See the [QR transfer guide](qr-transfer.md). The modes below apply to Morse.

## Choose matching Morse modes

**Character shuffle is enabled by default.** Generate an alphabet with **Shuffle** on one device, share it separately, and enter it on the other. It is basic obfuscation with no authentication. See the [character shuffle guide](security.md). To use ordinary Morse, switch shuffle off on both devices.

| Sender | Receiver “Listen as” | Use it for |
| --- | --- | --- |
| Text → Direct text | Text · letters & numbers | Ordinary messages using A–Z, 0–9, and supported punctuation |
| Text → Exact transfer | File / exact Unicode text | Emoji, Ethiopic text, mixed case, newlines, exact formatting |
| File | File / exact Unicode text | Any file type up to 2,048 bytes |

Direct text optionally substitutes letters and digits, then goes straight to Morse. The app does not wrap it in a binary frame. Received text is uppercase and repeated whitespace becomes one space. Unsupported characters produce an error before playback. A downloadable direct-text result is saved as a UTF-8 `.txt` file; this encoding is for the download, not for the Morse transmission.

Exact mode encodes the original bytes into Morse-compatible Base32 characters. Metadata and a checksum let the receiver reconstruct the original content. Files always use exact mode. When shuffle is enabled, the same shared alphabet replaces characters in the frame; the receiver reverses it before checking the original bytes. Switching back to Text preserves your previous text encoding choice.

## Speaker-to-microphone workflow

1. Put the devices near each other in a quiet room. Use moderate speaker volume to avoid clipping.
2. Set both to the same mode, frequency, WPM, shuffle setting, and alphabet. Try 700 Hz and 30 WPM first.
3. On the receiver, press **Start listening**, allow microphone access, and leave the page active.
4. On the sender, enter text or choose a tiny file. Check the transmission estimate.
5. Press **Play Morse sound**. Direct text appears incrementally in the received result; live Morse and decoded characters are available in the expandable signal section.
6. For exact mode, wait for **CHECKSUM OK**, then use **Download original**. An incomplete or corrupt frame is not accepted as an original file.
7. Press **Stop** to release the microphone when finished; use **Forget** to clear the code and received result. Shuffled text is reversed live without an unlock step.

Playback, listening, and the synthetic self-test are mutually exclusive on a single app instance. Stop the active action before changing audio settings or receiver mode. Cancelling a pending microphone request prevents a subsequently granted stream from staying active.

## Try higher speeds and tones

| Control | Available presets |
| --- | --- |
| Speed | 10, 20, 30, 40, 50, **60, 70, 80 WPM** |
| Tone | 550, 700, 900, **1,200, 1,500, 2,000, 3,000, 4,000 Hz** |

The default remains 30 WPM / 700 Hz. Speeds of 50 WPM or higher and tones above 900 Hz are marked experimental. Match both settings on the sender and receiver, including when using character shuffle.

1. Establish a successful short transfer at the default settings.
2. Try 60 WPM, then 70 and 80, keeping the tone unchanged. Change one setting at a time so you can identify what affects reception.
3. Try a higher tone such as 1,200 or 1,500 Hz. Test other presets with the same short message before attempting a file.
4. Run the audio self-test at each setting. With shuffle enabled, confirm the restored text matches the original.
5. Repeat on the actual speaker/microphone pair. If text is wrong or a packet fails its checksum, lower the speed or return to a tone that worked.

WPM controls transmission duration: 80 WPM is 1.6 times as fast as 50 WPM for the same prepared packet. A dot lasts 15 ms at 80 WPM, compared with 24 ms at 50. Increasing Hz changes the pitch, not the Morse timing or amount of data sent per second. A higher tone may suit a particular speaker/microphone, but is not automatically more reliable.

Synthetic tests restore packets at all offered higher-speed/tone combinations with modest generated noise and timing jitter, at 12,000, 44,100, and 48,000 samples per second. Direct, exact, and shuffled self-tests also pass at 80 WPM across all tones. These checks bypass real room acoustics, device filtering, clipping, and echo.

The current detector lost packets in synthetic probes at 100–120 WPM, so the interface stops at 80 WPM. Its five-millisecond analysis windows and two-window confirmation leave less timing margin as dots get shorter. Faster presets would require further receiver tuning and testing.

## Local self-test

Choose a receiver mode and press **Run audio self-test**. Text mode restores `HELLO 123`; exact mode restores `Hi 👋` with a valid checksum. With shuffle enabled, enter a valid alphabet first; the test checks substitution and its reversal. The signal is synthesized and decoded in memory. This checks application logic without requesting microphone access or playing sound.

## Build and use on phones

```sh
npm run check
npm run preview
```

`npm run build` produces `dist/`. Upload the **whole contents of `dist/`**, including `assets/`, to a trusted HTTPS static host. No application backend or server-side upload handler is required. This project has not been published automatically.

Vite bundles the microphone worklet as a separate ES module with a generated asset URL. Do not manually rename or omit its emitted asset. The build uses relative asset paths so it can be served at the root or under a subdirectory. Serve HTML as HTML and JavaScript assets as JavaScript, and preserve their paths.

The local dev/preview server binds to loopback by default. `--host 0.0.0.0` can make a dev server reachable on a LAN, but **ordinary HTTP on a LAN still does not enable phone microphone access**. Use a trusted HTTPS host or an HTTPS development proxy. Do not disable browser security or bypass certificate warnings.

### Temporary HTTPS with cloudflared

A phone can load the app through your computer’s HTTP LAN address, but its browser blocks microphone access there. `localhost` on the phone refers to the phone itself. A [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) provides a temporary trusted HTTPS URL for the local preview without a Cloudflare account or domain. Both the computer and phone need internet access for this setup.

**1. Install cloudflared once.** On macOS with Homebrew:

```sh
brew install cloudflared
```

If Homebrew is unavailable, or you use Windows/Linux, follow the official [cloudflared downloads and installation instructions](https://developers.cloudflare.com/tunnel/downloads/). Confirm installation with `cloudflared --version`.

**2. Start the built app in the first terminal.** Run from the project folder, with dependencies installed as described above:

```sh
nvm use
npm run build
npm run preview -- --port 4173 --strictPort
```

Skip `nvm use` if you already use a compatible Node version without nvm. Keep the preview running. `--strictPort` makes Vite fail if 4173 is occupied rather than quietly choosing another port. If you choose another free port, use that same port in both commands. The server can stay bound to loopback; no `--host 0.0.0.0` or router port forwarding is needed.

**3. Start the HTTPS tunnel in a second terminal.**

```sh
cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost
```

The `--http-host-header localhost` option sends an accepted local Host header to Vite, avoiding a blocked-host response without changing Vite’s allowed-host configuration. The tunnel serves the production build through the preview server.

**4. Open the printed HTTPS URL on the phone.** Look for an address ending in `trycloudflare.com` in the tunnel output. Open that exact `https://` address in Safari or Chrome, press **Start listening**, and allow the microphone. You can open the same URL on both devices, then follow the [speaker-to-microphone workflow](#speaker-to-microphone-workflow).

Keep both terminals running and the computer awake. Stop the tunnel and preview with **Ctrl+C** in their respective terminals when finished. Anyone with the generated URL can open the preview. It changes each time the tunnel restarts and stops working when the tunnel process stops. Quick Tunnels are for temporary testing; use a trusted static HTTPS host for a lasting deployment.

The tunnel delivers the webpage; it does not relay Morse audio between devices. Keep the devices near each other so the receiver’s microphone can hear the sender’s speaker. Selected content and microphone samples are still processed locally by the app. Web requests for the preview pass through Cloudflare.

After source changes, stop the preview, run `npm run build`, restart the preview on the same port, and refresh the phone. The existing tunnel can remain running while you rebuild. For setup errors, see [tunnel troubleshooting](troubleshooting.md#cloudflare-tunnel-setup).

## Privacy

Selected files, decoded content, microphone samples, and camera frames stay in the browser. No analytics or upload endpoint is built in. The acoustic transmission itself is audible to nearby devices and people. Character shuffle obscures letters with a fixed substitution; it is not strong encryption or authentication. Shared codes stay in page memory; see [security and privacy limits](security.md#protection-and-limits). Stopping reception or leaving the page releases audio resources. Host/server access logging, if any, is controlled by your chosen hosting provider.
