# Troubleshooting

[← Documentation home](../README.md#documentation)

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Vite reports an unsupported Node version | The terminal is using an older default Node | Run `nvm use`; confirm `node --version` is 22.12+ |
| The old interface appears | An old server or cached page is still open | Stop the old vanilla server, run `npm run dev`, and open the URL Vite prints |
| Microphone API is unavailable | Insecure HTTP origin | Use HTTPS or localhost on that device |
| Phone cannot listen through an HTTP LAN URL | HTTP LAN origins are generally not secure contexts | Serve the production build with trusted HTTPS |
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

## Browser checklist

Use a current browser with Web Audio, AudioWorklet, and microphone access enabled. Permissions must allow the site to use the microphone. Embedding inside another page may also require its Permissions Policy to allow microphone access. The app requests microphone access only when you press Start listening.

The in-app browser’s permission handling can differ from Safari/Chrome. If its microphone prompt cannot be completed, test the app in a normal browser. The synthetic self-test remains useful but does not prove physical reception.

## Diagnosis with live signal

1. Expand **Live decoded signal**.
2. If no dots/dashes appear, investigate permission, frequency, level, and threshold first.
3. If dots appear but characters are wrong, check WPM, echoes, and interruptions.
4. If characters are correct but no exact result appears, match receiver mode and ensure the complete frame was received.
5. For an integrity error, resend from the beginning. CRC32 does not repair damaged data.
