import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardHeading, Status } from './Shared.jsx';
import { usePreparedQr } from '../hooks/usePreparedQr.js';
import { useQrPlayback } from '../hooks/useQrPlayback.js';
import { useQrReceiver } from '../hooks/useQrReceiver.js';
import { QR_RATES, formatBytes } from '../lib/qr-transfer.mjs';
function QrDisplayControls({ playback, disabled, prefix = 'qr' }) {
  return <div className="qr-tuning">
    <label className="mode-label" htmlFor={`${prefix}-rate`}>Display speed <select id={`${prefix}-rate`} value={playback.fps} disabled={disabled} onChange={event => playback.setFps(Number(event.target.value))}>{QR_RATES.map(rate => <option key={rate} value={rate}>{rate} data QR {rate === 1 ? 'code' : 'codes'} / second{rate >= 8 ? ' · experimental' : ''}</option>)}</select></label>
    <label className="qr-size-label" htmlFor={`${prefix}-size`}><span>QR size <output htmlFor={`${prefix}-size`}>{playback.size} px</output></span><input id={`${prefix}-size`} type="range" min={240} max={960} step={40} value={playback.size} disabled={disabled} onChange={event => playback.setSize(Number(event.target.value))} /></label>
  </div>;
}
export default function QrTransfer({ inputKind, onKindChange, text, onTextChange, file, onFileChange, shuffle, code, onBusyChange, onDownload }) {
  const preparation = usePreparedQr({ inputKind, text, file, shuffle, code });
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef(null), closeButton = useRef(null), largePanel = useRef(null);
  const playback = useQrPlayback(preparation.transfer, expanded);
  const receiver = useQrReceiver({ shuffle, code, testKind: inputKind });
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const page = document.querySelector('main'), previousInert = page?.inert;
    if (page) page.inert = true;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key === 'Tab') {
        const controls = [...largePanel.current.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled])')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previousOverflow; if (page) page.inert = previousInert; window.removeEventListener('keydown', escape); expandButton.current?.focus(); };
  }, [expanded]);
  const busy = playback.playing || receiver.phase !== 'idle';
  const textTab = useRef(null), fileTab = useRef(null);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const transfer = preparation.transfer, manifest = transfer?.manifest;
  const stage = !transfer || playback.frame.index === 0 ? 'START' : playback.frame.index === transfer.frameCount - 1 ? 'END' : `DATA ${playback.frame.index} / ${manifest.c}`;
  const p = receiver.progress;
  const fraction = p.complete ? 1 : p.size ? p.receivedBytes / p.size : 0;
  function switchTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const kind = event.key === 'Home' ? 'text' : event.key === 'End' ? 'file' : inputKind === 'text' ? 'file' : 'text';
    onKindChange(kind); (kind === 'text' ? textTab : fileTab).current?.focus();
  }
  const display = <div className={`qr-display ${!transfer || !playback.ready ? 'qr-empty' : ''}`} style={{ '--qr-size': `${playback.size}px` }}><canvas ref={playback.canvasRef} role="img" aria-label={`Transfer QR code: ${stage}`} hidden={!transfer || !playback.ready} />{(!transfer || !playback.ready) && <p>{preparation.loading ? 'Preparing QR codes…' : 'Enter text or choose a file, then share your alphabet if shuffle is on.'}</p>}</div>;
  return <>
    {expanded && createPortal(<div className="qr-overlay" role="dialog" aria-modal="true" aria-labelledby="qr-large-title" onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}><div className="qr-large-panel" ref={largePanel}><div className="qr-large-heading"><div><h2 id="qr-large-title">QR display</h2><p>{stage} · Loop {playback.frame.loop} · {manifest ? formatBytes(manifest.s) : ''}</p></div><button id="qr-close-large" ref={closeButton} className="secondary" onClick={() => setExpanded(false)}>Close ✕</button></div><QrDisplayControls playback={playback} disabled={false} prefix="qr-large" />{display}<div className="button-row"><button id="qr-large-play" className="primary" disabled={playback.playing || !transfer || !playback.ready} onClick={playback.start}>▶ Start QR loop</button><button id="qr-large-pause" className="secondary" disabled={!playback.playing} onClick={playback.stop}>Pause</button></div><p className="helper">Adjust size and speed while sending. START and END hold for one second each. {playback.fps >= 8 ? 'Higher rates are experimental; slow down if frames are missed.' : 'Keep the full code and white border visible to the camera.'}</p></div></div>, document.body)}
    <div className="qr-intro"><p className="eyebrow">SCREEN → CAMERA → ORIGINAL CONTENT</p><p>Point the receiving camera at the sender’s screen. Codes loop automatically; missed chunks can be collected on the next pass.</p></div>
    <div className="workspace qr-workspace">
      <section className="card" aria-labelledby="qr-send-heading">
        <CardHeading number="01" title="Show QR codes" id="qr-send-heading" arrow="↗" />
        <div className="tabs" role="tablist" aria-label="QR input type">
          <button id="qr-text-tab" ref={textTab} className={`tab ${inputKind === 'text' ? 'active' : ''}`} role="tab" aria-selected={inputKind === 'text'} aria-controls="qr-text-panel" tabIndex={inputKind === 'text' ? 0 : -1} disabled={busy} onClick={() => onKindChange('text')} onKeyDown={switchTab}>Text</button>
          <button id="qr-file-tab" ref={fileTab} className={`tab ${inputKind === 'file' ? 'active' : ''}`} role="tab" aria-selected={inputKind === 'file'} aria-controls="qr-file-panel" tabIndex={inputKind === 'file' ? 0 : -1} disabled={busy} onClick={() => onKindChange('file')} onKeyDown={switchTab}>File</button>
        </div>
        <div id="qr-text-panel" role="tabpanel" aria-labelledby="qr-text-tab" hidden={inputKind !== 'text'}><label className="field-label" htmlFor="qr-message">Your message</label><textarea id="qr-message" rows={4} value={text} disabled={busy} onChange={event => onTextChange(event.target.value)} placeholder="Text, emoji, or any language…" /><div className="field-footer"><span>Original case, Unicode &amp; formatting preserved.</span><span>{formatBytes(new TextEncoder().encode(text).length)}</span></div></div>
        <div id="qr-file-panel" role="tabpanel" aria-labelledby="qr-file-tab" hidden={inputKind !== 'file'}><label className="file-drop" htmlFor="qr-file"><span className="file-icon" aria-hidden="true">↥</span><strong>{file?.name || 'Choose a file'}</strong><span>Any file type · up to 1 MB</span><input id="qr-file" type="file" disabled={busy} onChange={event => onFileChange(event.target.files[0] || null)} /></label></div>
        <QrDisplayControls playback={playback} disabled={receiver.phase !== 'idle'} />
        <div className="qr-view-tools"><p className="helper">Fits available space. Use Large view to enlarge it further.</p><button id="qr-expand" ref={expandButton} className="secondary" disabled={receiver.phase !== 'idle' || !transfer} onClick={() => setExpanded(true)}>⛶ Large view</button></div>
        {playback.fps >= 8 && <p className="helper qr-speed-note">Experimental rate. If progress stalls, slow down; missing frames can be collected on later loops.</p>}
        {!expanded && display}
        <div className="qr-frame-info"><strong>{transfer ? stage : 'NOT READY'}</strong><span>{playback.playing ? `Loop ${playback.frame.loop}` : 'Ready / paused'}</span></div>
        <div className="qr-stats"><div><span>CONTENT SIZE</span><strong>{manifest ? formatBytes(manifest.s) : '—'}</strong></div><div><span>DATA CHUNKS</span><strong>{manifest?.c ?? '—'}</strong></div><div><span>LOOP ESTIMATE</span><strong>{manifest ? `${(2 + manifest.c / playback.fps).toFixed(1)} sec` : '—'}</strong></div></div>
        <div className="button-row"><button id="qr-play" className="primary" disabled={busy || !transfer || !playback.ready} onClick={playback.start}>▶ Start QR loop</button><button id="qr-pause" className="secondary" disabled={!playback.playing} onClick={playback.stop}>Pause</button></div>
        <Status id="qr-send-status" message={preparation.error || playback.error || (playback.playing ? 'Looping START → numbered data → END. Stop when the receiver shows Verified.' : 'Start the receiving camera first, then start the loop. START and END stay visible for one second each.')} type={preparation.error || playback.error ? 'error' : ''} />
      </section>
      <section className="card" aria-labelledby="qr-receive-heading">
        <CardHeading number="02" title="Scan & restore" id="qr-receive-heading" arrow="↙" />
        <label className="mode-label" htmlFor="qr-camera">Camera <select id="qr-camera" value={receiver.camera} disabled={busy} onChange={event => receiver.setCamera(event.target.value)}><option value="environment">Rear camera · preferred</option><option value="user">Front camera</option></select></label>
        <div className={`camera-display ${receiver.phase === 'scanning' ? 'camera-active' : ''}`}><video ref={receiver.videoRef} muted playsInline aria-label="QR camera preview" /><div className="camera-idle"><span aria-hidden="true">▣</span><strong>{receiver.phase === 'requesting' ? 'Waiting for camera permission' : receiver.phase === 'testing' ? 'Testing QR image recovery' : 'Point your camera at the other screen'}</strong><small>HTTPS or localhost required</small></div></div>
        <div className="button-row"><button id="qr-scan" className="primary receive-button" disabled={busy} onClick={receiver.start}>{p.manifest && !p.complete ? '◉ Resume scanning' : '◉ Start camera'}</button><button id="qr-stop" className="secondary" disabled={!['requesting', 'scanning'].includes(receiver.phase)} onClick={receiver.stop}>Stop</button></div>
        <Status id="qr-receive-status" {...receiver.status} />
        <section className="qr-progress" aria-label="QR reception progress"><div className="qr-progress-heading"><strong>{p.manifest ? p.manifest.n || 'Incoming content' : 'Waiting for transfer metadata'}</strong><span>{Math.round(fraction * 100)}%</span></div><progress id="qr-progress" max={1} value={fraction} aria-label="Unique QR bytes received" /><p id="qr-progress-detail">{formatBytes(p.receivedBytes)} / {p.manifest ? formatBytes(p.size) : 'unknown size'} · {p.received} / {p.manifest ? p.total : '?'} chunks</p><div className="qr-markers"><span className={p.start ? 'seen' : ''}>{p.start ? '✓' : '○'} START</span><span className={p.end ? 'seen' : ''}>{p.end ? '✓' : '○'} END</span><span className={p.complete ? 'seen' : ''}>{p.complete ? '✓' : '○'} VERIFIED</span></div>{p.manifest && !p.complete && <p className="helper">{p.verifying ? 'All chunks found. Verifying the full content…' : p.received === p.total ? 'All bytes collected. Waiting for START / END markers.' : `${p.total - p.received} missing chunks. Keep the camera on the looping codes.`}</p>}</section>
        {receiver.result && <div className="result"><div className="result-heading"><strong>Original {receiver.result.kind} restored</strong><span className="verified">✓ SHA-256 VERIFIED</span></div><pre>{receiver.result.kind === 'text' ? receiver.result.text : `${receiver.result.name}\n${formatBytes(receiver.result.bytes.length)} · ${receiver.result.type}`}</pre><button id="qr-download" className="secondary" onClick={() => onDownload(receiver.result)}>Download original</button></div>}
        <div className="receiver-tools"><button id="qr-self-test" className="text-button" disabled={busy} onClick={receiver.selfTest}>Run QR image self-test</button><button id="qr-clear" className="text-button" disabled={playback.playing || receiver.phase === 'testing' || receiver.progress.verifying} onClick={receiver.clear}>Clear received chunks</button></div>
        <p className="helper">Stopping the camera keeps progress. Clear to switch transfers. Nothing is uploaded. {shuffle && 'Use the same shared alphabet; only encoded payload characters are shuffled, and metadata stays visible.'}</p>
      </section>
    </div>
    <section className="how-to" aria-label="How to transfer with QR"><div><span>1</span><p><strong>Camera first</strong>Allow camera access over HTTPS. Match shuffle settings and the shared alphabet.</p></div><div><span>2</span><p><strong>Loop the codes</strong>Fit the complete QR code in the square. Try 1–2 codes per second if frames are missed.</p></div><div><span>3</span><p><strong>Collect and verify</strong>Missing chunks arrive on the next loop. Download only after full checksum verification.</p></div></section>
  </>;
}
