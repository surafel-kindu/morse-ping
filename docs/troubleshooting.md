# Troubleshooting

[← Documentation home](../README.md#documentation)

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Vite reports an unsupported Node version | The terminal is using an older default Node | Run `nvm use`; confirm `node --version` is 22.12+ |
| The old interface appears | An old server or cached page is still open | Stop the old vanilla server, run `npm run dev`, and open the URL Vite prints |
| Microphone API is unavailable | Insecure HTTP origin | Use HTTPS or localhost on that device |
| Phone cannot listen through an HTTP LAN URL | HTTP LAN origins are generally not secure contexts | Follow the [Cloudflare HTTPS setup](getting-started.md#temporary-https-with-cloudflared) or use a trusted HTTPS host |
| Permission is denied | Browser or OS microphone permission was rejected | Allow the microphone for this site in browser/OS settings, then retry |
| Permission remains pending | A browser/OS prompt awaits a choice | Resolve the prompt or press Stop; a stream granted after cancellation is immediately released |
| No tone is detected | Wrong tone, quiet speaker, or high threshold | Match pitch, increase volume moderately, move closer, lower threshold, restart |
| Room noise creates dots | Threshold is too low or other sound overlaps the tone | Raise threshold and move to a quieter room |
| Higher experimental settings fail | Dots are shorter or the devices reproduce the tone poorly | Lower WPM first, try a previously successful tone, and test a short message; see [higher-speed/tone testing](getting-started.md#try-higher-speeds-and-tones) |
| Letters are wrong | Speed mismatch, echo, clipping, or interrupted audio | Match WPM, try 20 WPM, lower excessive volume, reposition the devices |
| Encoded characters appear instead of original text | Receiver is in Text mode while sender uses Exact mode | Select File / exact Unicode on the receiver and resend |
| No restored result in exact mode | Sender used Direct text, or frame is incomplete | Match modes; clear the signal and resend the entire exact transfer |
| Checksum fails | One or more characters were lost or misdecoded | Slow down, reduce echo/noise, clear, and resend |
| Unsupported-character error | Direct Morse cannot represent some input | Use Exact transfer for Unicode, emoji, or exact formatting |
| File cannot be selected for transfer | It exceeds 2,048 bytes or metadata limits | Choose a smaller file or shorten its filename |
| Audio stops when phone locks or page goes to background | Browser/OS audio suspension | Keep pages active and devices unlocked throughout the transfer |
| File transfer takes minutes | Morse plus Base32/metadata has low throughput | Use a tiny file; use Direct text for ordinary messages |
| Self-test passes but devices fail | Self-test bypasses speaker, microphone, and room acoustics | Follow the physical setup steps and test error rates at lower speed |

## Camera & QR

See [QR setup and troubleshooting](qr-transfer.md#troubleshooting) for camera permissions, stalled progress, missed markers, wrong alphabets, and stopping/resuming scans. The cloudflared HTTPS address works for the camera as well as the microphone.

## Character shuffle

| Symptom | What to do |
| --- | --- |
| Sending is disabled after opening the app | Shuffle is on by default; press Shuffle or enter the shared alphabet first, or switch it off on both devices |
| Shared code is rejected | Include A–Z and 0–9 exactly once, with no duplicates or missing symbols; spaces, dashes, and case are ignored |
| Text is garbled despite a clean signal | Confirm both devices use the identical alphabet and shuffle setting; wrong alphabets do not produce an authentication error |
| Exact transfer never appears with shuffle on | Match alphabets and receiver mode, clear the signal, and resend the complete frame |
| Changing A’s replacement changes another mapping | The editor swaps assignments so every replacement remains unique and reversible |
| Audio duration changes after shuffling | Characters have different Morse lengths; substitution changes symbols, but adds no characters |
| Reloading loses the code | Codes stay only in page memory; re-enter the separately shared alphabet |
| A captured encrypted packet from an older version cannot be restored | This version uses character substitution and does not support the previous MTE1 encrypted format |

See the [character shuffle guide](security.md) for the workflow and limits. Direct text has no checksum; exact mode checks corruption but does not authenticate a sender.

## Cloudflare tunnel setup

Follow the [two-terminal HTTPS setup](getting-started.md#temporary-https-with-cloudflared) first.

| Symptom | What to do |
| --- | --- |
| `cloudflared: command not found` | Install it with `brew install cloudflared` on macOS, or follow the [official downloads guide](https://developers.cloudflare.com/tunnel/downloads/); check `cloudflared --version` |
| Preview reports that port 4173 is in use | Choose a free port and change it in both the preview and tunnel commands; keep `--strictPort` |
| Tunnel URL returns 502 or cannot reach the origin | Keep the preview running; confirm `http://127.0.0.1:4173` opens on the computer and matches the tunnel’s `--url` |
| Vite reports a blocked host | Include `--http-host-header localhost` in the tunnel command |
| Phone still shows the HTTPS requirement | Open the printed `https://…trycloudflare.com` URL rather than the old HTTP LAN URL |
| HTTPS loads but microphone permission is denied | Allow microphone access for the new tunnel URL in Safari/Chrome and OS settings; restart listening |
| An old tunnel URL no longer opens | Keep the computer awake and both processes running; after restarting the tunnel, use its newly printed URL |
| Source edits do not appear on the phone | Rebuild with `npm run build`, restart the preview on the same port, and refresh the phone |

## Browser checklist

Use a current browser with Web Audio, AudioWorklet, and microphone access enabled. Permissions must allow the site to use the microphone. Embedding inside another page may also require its Permissions Policy to allow microphone access. The app requests microphone access only when you press Start listening.

The in-app browser’s permission handling can differ from Safari/Chrome. If its microphone prompt cannot be completed, test the app in a normal browser. The synthetic self-test remains useful but does not prove physical reception.

## Diagnosis with live signal

1. Expand **Live decoded signal**.
2. If no dots/dashes appear, investigate permission, frequency, level, and threshold first.
3. If dots appear but characters are wrong, check WPM, echoes, and interruptions.
4. If characters are correct but no exact result appears, match receiver mode and shuffle alphabet, and ensure the complete frame was received.
5. For an integrity error, resend from the beginning. CRC32 does not repair damaged data.
