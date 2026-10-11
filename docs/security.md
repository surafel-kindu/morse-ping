# Character shuffle

[← Documentation home](../README.md#documentation)

## A small shared alphabet

Character shuffle replaces each letter or digit with another before Morse playback. The receiver reverses that substitution as characters arrive. For example, `A → C`, `B → D`, and `C → E` turn `HELLO 123!` into `JGNNQ 123!` with this shared alphabet:

```text
Source: ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
Code:   CDEFGHIJKLMNOPQRSTUVWXYZAB0123456789
```

The code is the replacement row, in the fixed source order above. All 36 letters and digits must appear exactly once so every replacement can be reversed. Spaces, hyphens, and case in the code are ignored. Supported punctuation and message spaces are unchanged. Direct text is normalized to uppercase before substitution.

## Share and edit

1. Leave **Shuffle on** checked on both devices.
2. Press **Shuffle** on one device to generate an alphabet. Press **Copy** and share it separately; paste the same code on the other device. **Show** reveals it for manual copying.
3. Expand **View or edit character mappings** to customize replacements. Choosing `A → C` swaps A’s current replacement with the character currently mapped to C. This keeps all mappings reversible. Share the updated code after any edit.
4. Match transfer mode, WPM, and tone. Listen first, then send. Direct text restores live; exact text and files restore after their complete checksum-validated frame arrives. There is no unlock step.
5. Press **Forget** when finished. It clears the code and received result. Changing the code or shuffle setting also clears receiver state to avoid mixing alphabets. Controls are locked during active audio.

Codes stay in React page memory. They are not saved in local storage or sent within the Morse message. Reloading loses the code. **Shuffle** generates a fresh random permutation; it does not coordinate with the other device automatically. Both devices can turn shuffle off to send normal Morse.

## Transfer size and files

The substitution is one character for one character. Direct messages have no security header, salt, nonce, authentication tag, or additional packet. Different letters have different Morse lengths, so the audio duration can increase or decrease even though the character count stays the same. The displayed estimate uses the substituted symbols.

Exact mode first creates the ordinary MT1 frame for Unicode text or a file up to 2,048 bytes, then substitutes its letters and digits. The receiver reverses substitution before parsing metadata and checking CRC32. Unicode and binary bytes are preserved by exact mode; they are not directly substituted as arbitrary Unicode characters. See [wire details](protocol.md#character-shuffle).

## QR payload shuffle

Camera & QR mode uses the same alphabet to substitute Base32 payload characters. QR metadata, IDs, sizes, hashes, chunk numbers, and START/END markers remain readable. The receiver reverses payload substitution before CRC32 and SHA-256 checks. Match settings and alphabet on both devices. QR supports up to 1 MB; see the [QR guide](qr-transfer.md).

## Protection and limits

This is a fixed substitution cipher for basic obfuscation. Repeated letters remain repeated, spaces and punctuation remain visible, and an observer can recover mappings from patterns or known messages. It is not strong encryption and does not authenticate a sender. The previous AES-GCM packet mode has been replaced by this smaller shuffle; old encrypted MTE1 packets are not supported.

A wrong alphabet produces garbled direct text without a detectable wrong-code error. In exact mode it can prevent frame recognition or cause validation errors. CRC32 detects accidental corruption; anyone can recompute it, so **CHECKSUM OK** is not proof of authenticity. Resend using the same alphabet on both devices.

The page and devices can read both the code and original content. HTTPS enables microphone access and protects webpage delivery; it does not make this audible substitution confidential. Selected files and microphone samples are processed locally, with no application upload endpoint. Hosting or tunnel providers receive webpage requests.

## Try it locally

Enter the example code above and choose **Text · letters & numbers** on the receiver. **Run audio self-test** restores `HELLO 123` through the detector and reverse mapping. Select **File / exact Unicode text** and repeat to restore `Hi 👋` with a checksum. The self-test uses the same alphabet for both ends; it cannot detect mismatched codes on two devices and does not exercise physical speakers or microphones.
