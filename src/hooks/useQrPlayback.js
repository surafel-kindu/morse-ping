import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
export function useQrPlayback(transfer, expanded = false) {
  const canvasRef = useRef(null);
  const position = useRef({ index: 0, loop: 1 });
  const [frame, setFrame] = useState(position.current);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(4);
  const [size, setSize] = useState(360);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    position.current = { index: 0, loop: 1 }; setFrame(position.current); setPlaying(false);
  }, [transfer]);
  useEffect(() => {
    let cancelled = false, timer;
    setError(''); setReady(false);
    if (!transfer) return;
    let { index, loop } = position.current;
    async function draw() {
      try {
        await QRCode.toCanvas(canvasRef.current, transfer.frameAt(index), { errorCorrectionLevel: 'M', margin: 4, width: Math.max(480, size), color: { dark: '#000000', light: '#FFFFFF' } });
        if (cancelled) return;
        position.current = { index, loop }; setFrame(position.current); setReady(true);
        if (playing) timer = setTimeout(() => {
          if (++index === transfer.frameCount) { index = 0; loop++; }
          draw();
        }, index === 0 || index === transfer.frameCount - 1 ? 1000 : 1000 / fps);
      } catch (cause) { if (!cancelled) { setError(`Cannot display QR: ${cause.message}`); setPlaying(false); } }
    }
    draw();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [transfer, playing, fps, size, expanded]);
  useEffect(() => {
    const stop = () => setPlaying(false);
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hide); };
  }, []);
  return { canvasRef, frame, playing, ready, fps, size, error, setFps, setSize, start: () => { position.current = { index: 0, loop: 1 }; setPlaying(true); }, stop: () => setPlaying(false) };
}
