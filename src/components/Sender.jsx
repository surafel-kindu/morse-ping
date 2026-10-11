import { useRef } from 'react';
import { formatTime } from '../lib/transfer.mjs';
import { CardHeading, Status } from './Shared.jsx';
export default function Sender({ inputKind, onKindChange, text, onTextChange, file, onFileChange, textMode, shuffle, onModeChange, preparation, settings, audio }) {
  const textTab = useRef(null), fileTab = useRef(null);
  const { packet, error, loading } = preparation;
  const busy = audio.phase !== 'idle', sending = audio.phase === 'sending';
  const inputDisabled = sending || audio.phase === 'testing';
  const plain = inputKind === 'text' && textMode === 'plain';
  const seconds = packet ? packet.units * 1.2 / settings.wpm : 0;
  const defaultNotice = error ? { message: error, type: 'error' } : { message: loading ? 'Preparing your message…' : seconds > 180 ? `This transfer takes ${formatTime(seconds)}. Morse is best for very small messages.` : 'Ready when you are. Start the receiver first.' };
  const displayedNotice = sending ? { message: `Transmitting · ${formatTime(audio.playback.remaining)} remaining. Keep this page active.` } : audio.sendNotice || defaultNotice;
  function switchTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const kind = event.key === 'Home' ? 'text' : event.key === 'End' ? 'file' : inputKind === 'text' ? 'file' : 'text';
    onKindChange(kind); (kind === 'text' ? textTab : fileTab).current?.focus();
  }
  return <section className="card sender" aria-labelledby="send-heading">
    <CardHeading number="01" title="Send a message" id="send-heading" arrow="↗" />
    <div className="tabs" role="tablist" aria-label="Input type">
      <button id="text-tab" ref={textTab} className={`tab ${inputKind === 'text' ? 'active' : ''}`} role="tab" aria-selected={inputKind === 'text'} aria-controls="text-panel" tabIndex={inputKind === 'text' ? 0 : -1} disabled={inputDisabled} onClick={() => onKindChange('text')} onKeyDown={switchTab}>Text</button>
      <button id="file-tab" ref={fileTab} className={`tab ${inputKind === 'file' ? 'active' : ''}`} role="tab" aria-selected={inputKind === 'file'} aria-controls="file-panel" tabIndex={inputKind === 'file' ? 0 : -1} disabled={inputDisabled} onClick={() => onKindChange('file')} onKeyDown={switchTab}>File</button>
    </div>
    <div id="text-panel" role="tabpanel" aria-labelledby="text-tab" hidden={inputKind !== 'text'}>
      <label className="field-label" htmlFor="message">Your message</label><textarea id="message" rows={5} placeholder="A message worth sending…" value={text} disabled={inputDisabled} onChange={event => onTextChange(event.target.value)} />
      <div className="field-footer"><span id="text-note">{plain ? shuffle ? 'Shuffle characters, then send them directly as Morse.' : 'Send letters, numbers & punctuation directly.' : 'Exact transfer keeps case, emoji & Unicode.'}</span><span id="input-count">{plain ? `${[...text].length} characters` : `${new TextEncoder().encode(text).length} bytes`}</span></div>
    </div>
    <div id="file-panel" role="tabpanel" aria-labelledby="file-tab" hidden={inputKind !== 'file'}>
      <label className="file-drop" htmlFor="file"><span className="file-icon" aria-hidden="true">↥</span><strong>{file?.name || 'Choose a tiny file'}</strong><span>Any file type · up to 2 KB</span><input id="file" type="file" disabled={inputDisabled} onChange={event => onFileChange(event.target.files[0] || null)} /></label>
      <p className="helper">A photo is usually too large. Try a small .txt or .json file.</p>
    </div>
    <label className="mode-label" htmlFor="mode">Encoding <select id="mode" value={inputKind === 'file' ? 'exact' : textMode} disabled={inputDisabled || inputKind === 'file'} onChange={event => onModeChange(event.target.value)}><option value="plain">Direct text · letters &amp; numbers</option><option value="exact">Exact transfer · Unicode / file</option></select></label>
    <div className="estimate"><div><span>TRANSMISSION TIME</span><strong id="duration">{packet ? formatTime(seconds) : '—'}</strong></div><div><span>PAYLOAD</span><strong id="payload-size">{packet ? `${packet.count} ${packet.plain ? 'characters' : 'bytes'}` : '—'}</strong></div><span className={`tone-light ${sending && audio.playback.toneOn ? 'on' : ''}`} aria-label={sending && audio.playback.toneOn ? 'Tone on' : 'Tone off'} /></div>
    <progress value={audio.playback.progress} max={1} aria-label="Transmission progress" />
    <div className="button-row"><button className="primary" id="send" disabled={busy || !packet || loading} onClick={() => audio.send(packet)}>▶ Play Morse sound</button><button className="secondary" id="stop-send" disabled={!sending} onClick={audio.stopSending}>Stop</button></div>
    <Status id="send-status" {...displayedNotice} />
    {shuffle && packet && <div className="cipher-preview"><span className="field-label">Shuffled characters · ready for Morse</span><pre>{packet.wire.slice(0, 110)}{packet.wire.length > 110 ? '…' : ''}</pre><p className="helper">One character replaces another. No extra shuffle packet is sent.</p></div>}
    <details><summary>See the Morse code <span>↙</span></summary><pre className="morse-box" id="send-morse">{packet?.morse || ''}</pre><p className="helper">{plain ? 'Each letter, number, or supported punctuation mark goes directly to Morse. Text becomes uppercase with single spaces. Choose Text on the receiver; there is no checksum.' : 'Exact transfer encodes the original bytes, filename, and type in Morse-safe characters and adds a CRC32 checksum.'}</p>{shuffle && <p className="helper">The shared alphabet substitutes letters and digits before playback. The receiver reverses it before showing text or reading a file frame. Punctuation and spaces stay unchanged.</p>}</details>
  </section>;
}
