# Secure transfer

[← Documentation home](../README.md#documentation)

## A shared code, an encrypted signal

Secure transfer is enabled by default. It turns original content into encrypted characters before sending those characters as Morse. The receiver captures the encrypted packet and unlocks it using the shared code. Text, filename, MIME type, and payload length in the inner metadata are encrypted together.

The shared-code experience is inspired by Enigma. Protection uses the browser’s [AES-GCM authenticated encryption](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) and [HKDF key derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey). A fixed alphabet substitution or a historical rotor cipher would expose patterns and provide no dependable tamper detection.

## Use it on two devices

1. Open the app on both devices through HTTPS or localhost. For a phone, follow the [Cloudflare tunnel instructions](getting-started.md#temporary-https-with-cloudflared).
2. Leave **Secure transfer** enabled on both. The sender and receiver selectors show **Secure · encrypted text / file**.
3. On one device, press **Generate code**. Use **Copy code** or **Show** to share it in person or through a separate trusted channel. Enter the same code on the other device. Do not send it in the same audible transfer.
4. Match the speed and tone, then start listening on the receiver. You may capture a packet before entering the code.
5. Enter text or choose a file up to 2,048 bytes on the sender. Check the estimated duration, then play the Morse sound.
6. Wait for **Encrypted packet received**, then stop listening. The receiver shows no plaintext and offers no download while locked.
7. Press **Unlock & authenticate**. Only a successful authentication reveals the original and enables **Download original**.
8. Finish with **Forget code & clear result**. This clears the shared code and receiver result while leaving Secure transfer enabled. Reloading also clears the code.

If the code is wrong, the packet stays locked. Correct the code and try unlocking again without resending. A damaged transmission needs a full resend. Generating a new code changes future encryption; existing captured packets still require their original code. Changing the code clears an already unlocked receiver result. It does not erase text you typed in the sender.

The code has 32 Base32 characters, displayed in eight groups of four. Letter case, spaces, and dashes are ignored; the alphabet is A–Z and 2–7. **Generate code** uses 20 cryptographically random bytes, giving 160 bits of entropy. Manually choosing a patterned code can satisfy the format while offering much less protection. Use a generated code rather than a memorable phrase or PIN.

Codes are kept in React memory. They are not put in URLs, cookies, local storage, packet fields, or application network requests. Copying places the code on your clipboard; forgetting it in the app does not clear your clipboard or copies you shared. JavaScript garbage collection does not guarantee immediate wiping of old memory.

## What changes on the wire

The unencrypted Direct text and MT1 exact-transfer modes remain available by turning Secure transfer off. Secure mode uses a distinct `MTE1` frame and never falls back to plaintext reception. The outer characters are unpadded Base32 and standard Morse-compatible framing. Each new preparation gets a random 16-byte salt and 12-byte nonce; preparing the same input twice produces different encrypted characters.

AES-256-GCM encrypts the complete validated MT1 packet as UTF-8, with a 128-bit authentication tag. HKDF-SHA-256 derives a non-extractable AES key from the 160-bit shared code and random salt. There is no password-based derivation: codes are high-entropy random secrets, not human passwords. The 256-bit AES key does not increase the source secret’s 160-bit entropy.

An outer CRC32 detects acoustic corruption before unlocking. A valid CRC32 only means the packet can be checked; it does **not** authenticate it. AES-GCM verifies authenticity when you unlock, including when an attacker changes ciphertext and recomputes CRC32. See the [wire specification](protocol.md#encrypted-frame-version-mte1).

Encryption adds framing, randomness, and encoding overhead. It can take substantially longer than direct letters, and the displayed duration includes that overhead. It preserves Unicode and exact bytes rather than applying direct-text uppercasing. Replaying the same prepared sound sends the same encrypted packet; a new preparation produces new randomness.

## Protection and limits

This mode protects captured audio content from someone who does not have the shared code, and detects altered encrypted packets before releasing plaintext. Anyone possessing the code can both decrypt and create authenticated messages. Authentication proves possession of the code, not an individual sender’s identity.

Listeners can still hear that a transfer occurred and infer its approximate length. There is no padding, persistent replay protection, automatic code exchange, or forward secrecy. A recording can be replayed in a new session; later compromise of the shared code permits decryption of earlier recordings made with it. The receiver’s bounded duplicate suppression only avoids repeated displays in the current session and resets on Clear signal.

The app and devices must be trusted: malicious page code, browser extensions, or a compromised device could read the code and plaintext. HTTPS protects delivery of the app; a tunnel does not replace encryption of the acoustic transfer. The app does not upload microphone samples or selected files. Hosting/tunnel providers receive webpage requests.

This is an experimental transfer protocol using established browser cryptography; it has not had an independent security audit. Physical two-device acoustic reliability also remains a separate test.

## Try the complete unlock flow

With a generated code entered, press **Run audio self-test** in Secure transfer mode. It synthesizes an encrypted Unicode packet, processes it through the tone detector and decoder, and leaves a test packet locked. Press **Unlock & authenticate** to restore `Hi 👋`. You can first enter a different valid code to check that it remains locked, then restore the original code and unlock it.

The Node tests also cover randomization, Unicode and binary files, empty/2 KB boundaries, wrong codes, changed salt/nonce/ciphertext with recomputed checksums, malformed frames, plaintext downgrade rejection, and independent Web Crypto interoperability.
