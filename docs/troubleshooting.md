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
| Letters are wrong | Speed mismatch, echo, clipping, or interrupted audio | Match WPM, try 20 WPM, lower excessive volume, reposition the devices |
| Encoded characters appear instead of original text | Receiver is in Text mode while sender uses Exact mode | Select File / exact Unicode on the receiver and resend |
| No restored result in exact mode | Sender used Direct text, or frame is incomplete | Match modes; clear the signal and resend the entire exact transfer |
| Checksum fails | One or more characters were lost or misdecoded | Slow down, reduce echo/noise, clear, and resend |
| Unsupported-character error | Direct Morse cannot represent some input | Use Exact transfer for Unicode, emoji, or exact formatting |
| File cannot be selected for transfer | It exceeds 2,048 bytes or metadata limits | Choose a smaller file or shorten its filename |
| Audio stops when phone locks or page goes to background | Browser/OS audio suspension | Keep pages active and devices unlocked throughout the transfer |
| File transfer takes minutes | Morse plus Base32/metadata has low throughput | Use a tiny file; use Direct text for ordinary messages |
| Self-test passes but devices fail | Self-test bypasses speaker, microphone, and room acoustics | Follow the physical setup steps and test error rates at lower speed |

## Secure transfer

| Symptom | What to do |
| --- | --- |
| Sending is disabled after opening the app | Secure transfer is on by default; generate or enter the shared code first |
| Shared code is rejected | Use 32 characters from A–Z and 2–7; spaces, dashes, and case are ignored. Generate the code once and share it separately |
| Packet is locked and Unlock is disabled | Stop listening and enter a correctly formatted code |
| Wrong-code or altered-packet error | Check the code against the sender; correct it and unlock the existing packet again. If the signal was altered, resend |
| Secure receiver shows no restored result | Both devices must enable Secure transfer; it rejects unencrypted transfers and incomplete packets |
| Filename or original text is unavailable while receiving | Metadata and content are encrypted; they appear only after the full packet authenticates |
| Secure transfer is slower than direct text | Encryption and encoding add overhead; use the displayed estimate and keep private transfers short |
| A previously captured packet fails after generating a new code | Unlock it with the code used when that packet was prepared |
| Reloading loses the code | Codes are intentionally kept only in page memory; re-enter the separately shared code |

See the [security guide](security.md) for the full workflow and protection limits.

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
4. If characters are correct but no exact result appears, match receiver mode and ensure the complete frame was received.
5. For an integrity error, resend from the beginning. CRC32 does not repair damaged data.
