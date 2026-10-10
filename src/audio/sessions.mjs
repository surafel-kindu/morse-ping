import workletURL from './receiver-worklet.mjs?worker&url';

function createContext() {
  const Constructor = window.AudioContext || window.webkitAudioContext;
  if (!Constructor) throw new Error('This browser does not support Web Audio. Try a current browser.');
  return new Constructor({ latencyHint: 'interactive' });
}
function closeContext(context) {
  if (context.state !== 'closed') return context.close().catch(() => {});
}
export function createTransmitter({ segments, wpm, frequency, onProgress, onComplete }) {
  const context = createContext();
  let cancelled = false, animation, oscillator;
  const stop = () => {
    cancelled = true; cancelAnimationFrame(animation);
    if (oscillator) oscillator.onended = null;
    return closeContext(context);
  };
  return {
    stop,
    async start() {
      await context.resume(); if (cancelled) return;
      oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = 0;
      oscillator.connect(gain).connect(context.destination);
      const start = context.currentTime + .25, unit = 1.2 / wpm;
      const edges = []; let end = start;
      for (const segment of segments) {
        const next = end + segment.units * unit;
        if (segment.on) {
          const ramp = Math.min(.003, unit * .1);
          gain.gain.setValueAtTime(0, end); gain.gain.linearRampToValueAtTime(.35, end + ramp);
          gain.gain.setValueAtTime(.35, next - ramp); gain.gain.linearRampToValueAtTime(0, next);
        }
        edges.push({ start: end, end: next, on: segment.on }); end = next;
      }
      let edgeIndex = 0;
      const draw = () => {
        if (cancelled) return;
        const now = context.currentTime;
        while (edgeIndex < edges.length - 1 && edges[edgeIndex].end < now) edgeIndex++;
        onProgress({ progress: Math.max(0, Math.min(1, (now - start) / (end - start))), remaining: Math.max(0, end - now), toneOn: now >= start && now < end && edges[edgeIndex]?.on });
        animation = requestAnimationFrame(draw);
      };
      oscillator.onended = () => {
        if (cancelled) return;
        cancelAnimationFrame(animation); onProgress({ progress: 1, remaining: 0, toneOn: false });
        onComplete(); stop();
      };
      oscillator.start(start); oscillator.stop(end + .05); draw();
    },
  };
}
export function createMicrophoneReceiver({ wpm, frequency, threshold, decoder, onLevel, onSuspended, onDisconnected }) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost. A phone cannot listen using an ordinary HTTP LAN address.');
  const context = createContext();
  let cancelled = false, stream, node, source;
  const stop = () => {
    cancelled = true; context.onstatechange = null;
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    if (node) { node.port.onmessage = null; node.disconnect(); node.port.close(); }
    source?.disconnect();
    return closeContext(context);
  };
  return {
    stop,
    async start() {
      await context.resume(); if (cancelled) return false;
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (cancelled) { stream.getTracks().forEach(track => track.stop()); return false; }
      if (!context.audioWorklet) throw new Error('AudioWorklet is unavailable. Try a current browser over HTTPS.');
      await context.audioWorklet.addModule(workletURL); if (cancelled) return false;
      node = new AudioWorkletNode(context, 'morse-receiver', { processorOptions: { frequency, threshold } });
      source = context.createMediaStreamSource(stream);
      node.port.onmessage = ({ data }) => { if (!cancelled) { decoder.update(data); onLevel(data); } };
      source.connect(node).connect(context.destination);
      await context.resume(); if (cancelled) return false;
      context.onstatechange = () => { if (!cancelled && context.state === 'suspended') onSuspended(); };
      stream.getTracks().forEach(track => { track.onended = () => { if (!cancelled) onDisconnected(); }; });
      return true;
    },
  };
}
