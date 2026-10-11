import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import QRCode from 'qrcode';
import { createQrCollector, createQrTransfer } from '../lib/qr-transfer.mjs';
const initial = { manifest: null, received: 0, total: 0, receivedBytes: 0, size: 0, start: false, end: false, complete: false, verifying: false };
const notice = (message, type = '') => ({ message, type });
export function useQrReceiver({ shuffle, code, testKind = 'text' }) {
  const videoRef = useRef(null), active = useRef(null), collectorRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [camera, setCamera] = useState('environment');
  const [progress, setProgress] = useState(initial);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(notice('Camera images stay on this device.'));
  const current = session => active.current === session;
  function release(session) {
    session?.collector?.cancelVerification();
    session?.scanner?.pause(true); session?.scanner?.destroy();
    session?.stream?.getTracks().forEach(track => track.stop());
    session?.engine?.terminate?.();
  }
  function stop(message = 'Camera stopped. Collected chunks are kept; resume to fill the gaps.') {
    const session = active.current; active.current = null; release(session);
    setPhase('idle'); if (collectorRef.current) setProgress(collectorRef.current.snapshot()); setStatus(notice(message));
  }
  useEffect(() => {
    const leave = () => { const session = active.current; active.current = null; release(session); setPhase('idle'); if (collectorRef.current) setProgress(collectorRef.current.snapshot()); setStatus(notice('Camera paused. Resume scanning when this page is active.')); };
    const hide = () => { if (document.hidden) leave(); };
    window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hide); const session = active.current; active.current = null; release(session); };
  }, []);
  useEffect(() => { collectorRef.current = null; setProgress(initial); setResult(null); setStatus(notice('Camera images stay on this device.')); }, [shuffle, code]);
  function makeCollector() {
    const collector = createQrCollector({ shuffle, code,
      onProgress: value => { if (collectorRef.current === collector && active.current?.collector === collector) setProgress(value); },
      onResult: value => {
        if (collectorRef.current !== collector || active.current?.collector !== collector) return;
        setResult(value); setProgress({ ...collectorRef.current.snapshot(), verifying: false });
        const session = active.current; active.current = null; release(session); setPhase('idle');
        setStatus(notice(`Transfer verified · ${value.bytes.length} bytes restored. Camera released.`, 'success'));
      },
    });
    return collector;
  }
  function clear() {
    collectorRef.current?.reset(); setResult(null); setProgress(initial); setStatus(notice('Cleared. Point at the sender’s looping QR codes to receive a transfer.'));
  }
  async function start() {
    if (active.current) return;
    const session = {}; active.current = session; setPhase('requesting');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost. Use the cloudflared HTTPS URL on your phone.');
      if (result) { collectorRef.current = null; setResult(null); setProgress(initial); }
      const collector = collectorRef.current || makeCollector(); collectorRef.current = collector; session.collector = collector;
      setStatus(notice('Requesting camera access…'));
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: camera }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (!current(session)) { release(session); return; }
      videoRef.current.srcObject = session.stream;
      session.stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (current(session)) stop('The camera disconnected. Resume scanning to continue.'); }, { once: true }));
      session.scanner = new QrScanner(videoRef.current, async decoded => {
        if (!current(session)) return;
        try {
          const state = await collector.accept(decoded.data);
          if (!current(session)) return;
          if (state === 'other-transfer') setStatus(notice('Another transfer is visible. Clear received chunks to switch to it.'));
          else if (state === 'waiting-start') setStatus(notice('Data found. Waiting for a START or END marker on the next loop.'));
          else if (state === 'accepted') setStatus(notice('Collecting unique chunks. Keep scanning; missing chunks arrive on later loops.'));
        } catch (error) { if (current(session)) setStatus(notice(error.message, 'error')); }
      }, { preferredCamera: camera, maxScansPerSecond: 25, returnDetailedScanResult: true, onDecodeError: () => {}, calculateScanRegion: video => {
        const size = Math.min(video.videoWidth, video.videoHeight);
        return { x: (video.videoWidth - size) / 2, y: (video.videoHeight - size) / 2, width: size, height: size, downScaledWidth: 600, downScaledHeight: 600 };
      } });
      await session.scanner.start();
      if (current(session)) { setPhase('scanning'); setStatus(notice('Camera ready. Fit the entire QR code inside the square, including its white border.')); }
    } catch (error) {
      if (!current(session)) return;
      active.current = null; release(session); setPhase('idle');
      setStatus(notice(error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access for this site and retry.' : error.name === 'NotFoundError' ? 'No camera found on this device.' : error.message || String(error), 'error'));
    }
  }
  async function selfTest() {
    if (active.current) return;
    const session = {}; active.current = session; setPhase('testing'); setResult(null); setProgress(initial);
    setStatus(notice('Reading generated QR images, skipping a chunk, then recovering it on a second loop…'));
    try {
      const expected = 'QR loop recovery · Hi 👋\n'.repeat(24);
      const bytes = testKind === 'file' ? Uint8Array.from({ length: 900 }, (_, i) => i % 256) : new TextEncoder().encode(expected);
      const transfer = await createQrTransfer(bytes, { kind: testKind, name: testKind === 'file' ? 'qr-test.bin' : 'message.txt', type: testKind === 'file' ? 'application/octet-stream' : 'text/plain', shuffle, code });
      collectorRef.current = makeCollector(); session.collector = collectorRef.current;
      session.engine = await QrScanner.createQrEngine();
      if (!current(session)) { release(session); return; }
      const canvas = document.createElement('canvas');
      // Skip chunk 1 on the first pass and repeat chunk 0: progress must deduplicate.
      const order = [0, 1, 1, ...Array.from({ length: transfer.manifest.c - 2 }, (_, i) => i + 3), transfer.frameCount - 1, 0, 2];
      for (const index of order) {
        if (!current(session)) return;
        await QRCode.toCanvas(canvas, transfer.frameAt(index), { width: 600, margin: 4, errorCorrectionLevel: 'M' });
        const decoded = await QrScanner.scanImage(canvas, { qrEngine: session.engine, returnDetailedScanResult: true });
        if (!current(session)) return;
        await collectorRef.current.accept(decoded.data);
      }
      if (collectorRef.current.snapshot().complete) setStatus(notice('QR image self-test passed: a missed chunk recovered on the second loop; full checksum verified. Physical camera testing is still needed.', 'success'));
      else throw new Error('QR self-test did not restore the complete message.');
    } catch (error) { if (current(session)) setStatus(notice(error.message || String(error), 'error')); }
    finally { if (current(session)) { active.current = null; release(session); setPhase('idle'); } }
  }
  return { videoRef, phase, camera, setCamera, progress, result, status, start, stop: () => stop(), clear, selfTest };
}
