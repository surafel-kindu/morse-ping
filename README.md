# Morse Transfer

A one-page, browser-only prototype for transferring text or tiny files through audible International Morse code. The sender plays a sine-wave tone. A second device listens through its microphone, detects the tone, and decodes Morse timings. In Text mode, letters appear directly as they arrive. In File / exact Unicode mode, the original payload is restored after CRC32 verification. No application data is uploaded. Ordinary text is transmitted as letters rather than a byte frame. There are no external packages or CDN dependencies.

## Run locally

Requires Node.js 18 or newer. No `npm install` is needed.

```sh
cd "/Users/surafelmulaw/Documents/Afroawi Projects/Morse Transfer"
npm start
```

Open http://localhost:5173. If the port is occupied, use `PORT=5174 npm start`.

The included development server binds to this computer's loopback interface. It is for local testing, not a phone-accessible deployment. Do not open `index.html` directly: JavaScript modules and the receiver worklet need a web server.

## Use two devices

Serve these six files from an HTTPS static host accessible on both devices:

- `index.html`
- `styles.css`
- `app.mjs`
- `core.mjs`
- `tone-detector.mjs`
- `receiver-worklet.mjs`

Serve `.mjs` files as JavaScript (`text/javascript`), as the included server does. No backend is required. The site has not been deployed to an external host.

1. Open the same app on both devices. Choose **Direct text** on the sender and **Text · letters & numbers** on the receiver for ordinary messages. For files or Unicode text, choose **Exact transfer** on the sender and **File / exact Unicode text** on the receiver. Start with 30 WPM and 700 Hz on both; use 20 WPM if reception fails.
2. On the receiving device, press **Start listening**, grant microphone permission, and keep that page in the foreground.
3. On the sending device, enter a short message or choose a file no larger than 2,048 bytes. Check the time estimate before playing. Start with something like `Hi`.
4. Put the devices near each other in a quiet room and use moderate speaker volume. Press **Play Morse sound**.
5. Direct text appears as each letter arrives, without a checksum. For file/Unicode transfers, wait for **CHECKSUM OK**, then read the exact text or download the original bytes. Stop listening when finished.

A phone accessing `http://192.168.x.x:5173` cannot normally use the microphone: browser microphone access requires a secure context, usually HTTPS or that device's own localhost. Changing the server binding alone will not solve this. Use trusted HTTPS; do not disable browser security.

If tones are missed, stop listening, lower the detection threshold, and restart. If room noise creates dots, increase the threshold. Clear the signal and resend the entire message after a failure. Keep the microphone away from the speaker enough to avoid clipping and strong reverberation.

## Two encoding modes

**Exact transfer** is used for files, or optionally for text that needs exact preservation. Choose **File / exact Unicode text** on the receiver. It preserves Unicode (including Ethiopic), case, emoji, newlines, and arbitrary file bytes. The file or UTF-8 text is Base32-encoded, then each Base32 character is transmitted as ordinary Morse. A frame includes metadata, length, and a CRC32 checksum. This preserves the content but adds transmission time.

**Direct text** (the default) sends supported letters, digits, and punctuation directly as Morse symbols, without encoding the message as a byte frame. It normalizes text to uppercase and single spaces, rejects unsupported characters, and shows the result live in **Received text**. Choose **Text · letters & numbers** on the receiver. This mode is much faster for ordinary messages. It has no checksum or automatic original-file recovery.

The detector expects generated Morse beeps at the selected frequency and speed. It does not transcribe a person speaking “dot” and “dash”, automatically discover speed/pitch, or support Farnsworth spacing.

## How fast is it?

Standard Morse timing uses a dot of `1.2 / WPM` seconds, a dash of three dots, a one-dot intra-character pause, a three-dot letter pause, and a seven-dot word pause. The PARIS reference word occupies 50 units.

| Speed | Dot | Plain HELLO WORLD | Example 1 KiB binary file, exact transfer |
| --- | ---: | ---: | ---: |
| 20 WPM | 60 ms | 7.1 seconds | 21.0 minutes |
| 30 WPM | 40 ms | 4.7 seconds | 14.0 minutes |
| 50 WPM | 24 ms | 2.8 seconds | 8.4 minutes |

These are calculated transmission times, not measured acoustic performance. The file example contains byte values 0–255 repeated, with filename `sample.bin` and MIME type `application/octet-stream`. Times vary with the bytes, filename, and MIME type. The app calculates the actual duration for your input. Fifty WPM is experimental for real speakers and microphones.

The tone detector analyzes five-millisecond windows and confirms transitions over two windows. Decoding runs while audio arrives; each character becomes available after its trailing gap (roughly 2–3 dots plus browser/device latency). Processing is not the main speed limit: the duration of the Morse itself is. Start at 20–30 WPM and measure the error rate on your own device pair.

For large files or high throughput, a purpose-built acoustic modem with FSK/PSK, packet retries, and error correction would be a better next project than increasing Morse speed.

## Verification

```sh
npm test
```

The tests verify exact Unicode and binary round trips, empty files, length limits, canonical Base32, corruption detection, frame boundaries, standard timing, and sample-level tone-to-packet decoding at 10–50 WPM with modest generated noise and timing jitter. An isolated AudioWorklet harness checks registration, audio processing, and silent output without DOM globals.

**Run audio self-test** in the app synthesizes a Morse frame in memory, feeds it through the same tone detector, and verifies the selected mode: direct letters/numbers or exact Unicode recovery. It does not use a microphone or speaker. Playback controls, text validation, responsive layout, and the browser self-test were checked during implementation. A real two-device acoustic transfer has not been measured. Microphone testing in the in-app browser initially waited for permission, so receiver startup is not asserted as verified on that browser.

## Prototype limits

- Exact payloads are capped at 2 KB. File name and MIME metadata are capped at 120 JavaScript characters each.
- Sender and receiver must use matching frequency and speed. Detection is fixed-frequency, with a user-set amplitude threshold; it is sensitive to noise, echoes, clipping, frequency drift, and device audio processing.
- CRC32 detects accidental corruption. It does not correct errors or provide authentication or encryption. A successful checksum means the received frame passed the integrity check; the sender has no acknowledgement channel.
- No chunking, automatic retry, resume, or forward error correction. Resend failed transfers from the beginning.
- Background tabs, locked phones, notifications, and OS audio interruptions may pause or disrupt reception. Use the foreground page throughout.
- Downloads require a click. Received files are never executed by the app.

## Package option and references

[`morse-pro`](https://gitlab.com/scphillips/morse-pro) is an existing JavaScript library for text/Morse translation, audio playback, microphone listening, and adaptive timing/frequency decoding. Its [maintainer's overview](https://github.com/scp93ch/morse-pro) lists `MorseListener`, `MorseDecoder`, `MorseDecoderAdaptive`, and `MorsePlayerWAA`. It can simplify the Morse layer, but binary file framing, checksums, and retries still need application logic. This prototype implements the small required Morse layer directly.

- [International Morse timing, by the morse-pro author](https://morsecode.world/international/timing/)
- [Microphone permissions and secure contexts (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [AudioWorklet processing (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
