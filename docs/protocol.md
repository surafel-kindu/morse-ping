# Morse and transfer protocol

[← Documentation home](../README.md#documentation)

## Direct text

Direct text sends each supported character as International Morse. There is no Base32 wrapper, file metadata, or checksum.

```text
Input:   Hello 123
Wire:    HELLO 123
Morse:   .... . .-.. .-.. --- / .---- ..--- ...--
Result:  HELLO 123
```

The sender uppercases text, collapses whitespace, and rejects unsupported characters. Supported characters are A–Z, digits 0–9, and these punctuation marks:

```text
. , ? ' ! / ( ) & : ; = + - _ " @
```

The dot/dash string shown in the interface uses spaces between letters and `/` between words. These display separators are pauses in the actual sound, not additional transmitted characters. A literal slash in the input has its own Morse symbol.

Direct text is limited to 2,048 normalized characters. The receiver displays letters as they arrive; it cannot verify whether a letter was lost or misheard. A download encodes the received text as UTF-8 only when saving it to disk.

## Timing

Let `u = 1.2 / WPM` seconds.

| Element | Duration |
| --- | ---: |
| Dot | `u` |
| Dash | `3u` |
| Gap inside a character | `u` |
| Gap between characters | `3u` |
| Gap between words | `7u` |

The reference word `PARIS`, including its following word gap, occupies 50 units. At 30 WPM a dot lasts 40 ms. The prototype receiver flushes a character after at least two units of silence and treats at least five units as a word boundary, allowing some timing tolerance. These decision thresholds sit between the nominal one/three/seven-unit gaps.

## Exact-transfer frame, version MT1

```text
VVV MT1 HEADER PAYLOAD CHECKSUM END
```

Fields are separated by ordinary Morse word gaps:

| Field | Meaning |
| --- | --- |
| `VVV` | Repeated-letter preamble |
| `MT1` | Protocol version marker |
| `HEADER` | UTF-8 JSON metadata, encoded with unpadded Base32 |
| `PAYLOAD` | Original bytes in unpadded Base32; `0` represents an empty file |
| `CHECKSUM` | Eight uppercase hexadecimal characters containing CRC32 |
| `END` | Frame terminator |

Base32 uses `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`. Every character is representable by standard Morse. Receiver mode chooses whether decoded characters are displayed as plain text or interpreted as this file/Unicode protocol; the microphone detector itself is shared by direct, exact, and secure modes.

### Header

```json
{"k":"f","n":"note.txt","t":"text/plain","s":12}
```

- `k`: `t` for exact text, `f` for a file.
- `n`: download filename.
- `t`: MIME type supplied by the browser, or a default.
- `s`: original payload length in bytes.

Exact text defaults to `message.txt` and `text/plain`. Filename and MIME type are limited to 120 JavaScript string code units each. Metadata is carried in the sound, so longer metadata takes longer to transmit.

### Integrity

CRC32 is calculated over the **decoded header bytes followed by the original payload bytes**. It uses the reflected polynomial `0xEDB88320`, initial value `0xFFFFFFFF`, and final XOR `0xFFFFFFFF`.

The receiver requires the fixed field count, valid Base32, canonical final bits, valid header fields, a matching length, a payload no larger than 2,048 bytes, and a valid checksum. Header encodings longer than 2,000 characters are rejected. The frame parser uses fixed field positions so a payload token equal to `END` does not prematurely terminate the frame.

A checksum failure produces an error and does not deliver that frame as a restored original. Exact mode emits a result only after the whole frame is decoded and validated. The receiver keeps a bounded set of seen frames to avoid repeatedly reporting the same frame within a listening session; clearing the signal resets it.

### Scope

MT1 is a small experimental one-way protocol. CRC32 detects accidental errors; it is not authentication or encryption. There is no acknowledgement, sequence number, automatic retry, chunking, resume, or forward error correction. A failed transfer must be resent in full.

## Encrypted frame, version MTE1

```text
VVV MTE1 SALT NONCE CIPHERTEXT CHECKSUM END
```

| Field | Meaning |
| --- | --- |
| `SALT` | 16 random bytes, 26 unpadded Base32 characters |
| `NONCE` | 12 random bytes, 20 unpadded Base32 characters |
| `CIPHERTEXT` | AES-GCM encrypted UTF-8 MT1 frame followed by its 16-byte tag, in unpadded Base32 |
| `CHECKSUM` | CRC32 over decoded salt, nonce, then ciphertext including tag |

The shared code is 20 random bytes, displayed as 32 Base32 characters grouped with dashes. Decode the canonical, uppercase, whitespace/dash-free code to bytes. Import these as HKDF key material and derive a non-extractable 256-bit AES-GCM key with SHA-256, the decoded salt, and UTF-8 info:

```text
Morse Transfer / MTE1 / AES-256-GCM / HKDF-SHA-256
```

Use the same UTF-8 string as AES-GCM additional authenticated data, the decoded nonce as `iv`, and `tagLength: 128`. The encrypted plaintext is the complete validated MT1 frame as UTF-8, preserving the original payload and hiding the filename, type, and inner length. This suite is fixed; incoming data cannot select weaker algorithms or change a derivation work factor.

Parsing requires exactly seven fields, canonical Base32, exact salt/nonce sizes, at least a 16-byte tag, an eight-character hexadecimal checksum, ciphertext no larger than 6,000 bytes, and frame text no longer than 9,800 characters. The recovered inner MT1 frame must pass its existing validation, including the 2,048-byte original payload limit. The 16,000-character decoder window fits the maximum outer frame. Secure reception does not accept MT1 or direct text as original content.

The outer checksum is checked before showing **Locked**. Authentication is checked only on **Unlock & authenticate**. Wrong-code or altered-packet failures release no plaintext and preserve the captured packet for another attempt. The shared code is never transmitted. A fresh preparation generates a new salt and nonce; replaying a prepared sound repeats the existing ciphertext. There is no persistent replay protection or forward secrecy. See [security assumptions](security.md#protection-and-limits).

## Speed examples

| WPM | Dot | Direct `HELLO WORLD` | Representative 1 KiB file |
| --- | ---: | ---: | ---: |
| 20 | 60 ms | 7.08 sec | 20.96 min |
| 30 | 40 ms | 4.72 sec | 13.97 min |
| 50 | 24 ms | 2.83 sec | 8.38 min |
| 80 | 15 ms | 1.77 sec | 5.24 min |

Changing the tone frequency changes the pitch, not these durations. The available presets and receiver limits are described in [higher-speed/tone testing](getting-started.md#try-higher-speeds-and-tones).

The file example uses bytes 0–255 repeated, filename `sample.bin`, and type `application/octet-stream`. These values are calculated from the emitted timing sequence. They are not measured performance guarantees. Actual duration depends on the Morse lengths of the encoded content and metadata; successful reception also depends on hardware, noise, and echoes.

[International Morse timing reference](https://morsecode.world/international/timing/)
