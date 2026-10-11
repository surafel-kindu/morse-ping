import { useEffect, useRef, useState } from 'react';
import { createTransmitter, createMicrophoneReceiver } from '../audio/sessions.mjs';
import { createMessageDecoder, runAudioSelfTest } from '../lib/transfer.mjs';
const notice = (message, type = '') => ({ message, type });
const emptySignal = { characters: '', morse: '' };

export function useAudioTransfer(settings, receiveMode, { shuffle = false, code = '' } = {}) {
  const active = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [sendNotice, setSendNotice] = useState(null);
  const [receiveNotice, setReceiveNotice] = useState(notice('Microphone audio stays on this device.'));
  const [playback, setPlayback] = useState({ progress: 0, remaining: 0, toneOn: false });
  const [level, setLevel] = useState({ amplitude: 0, on: false });
  const [signal, setSignal] = useState(emptySignal);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const release = () => { const session = active.current; active.current = null; session?.stop(); };
    const onPageHide = () => {
      release(); setPhase('idle');
      setPlayback(value => ({ ...value, toneOn: false })); setLevel({ amplitude: 0, on: false });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => { window.removeEventListener('pagehide', onPageHide); release(); };
  }, []);
  const current = session => active.current === session;
  function clear() {
    active.current?.decoder?.reset(); setSignal(emptySignal); setResult(null);
    setReceiveNotice(notice(active.current ? 'Signal cleared. Start a complete transmission.' : 'Microphone audio stays on this device.'));
  }
  function messageCallbacks(session) {
    return {
      onSignal: value => { if (current(session)) setSignal(value); },
      onResult: value => {
        if (!current(session)) return;
        setResult(value);
        setReceiveNotice(value.verified ? notice(`Transfer verified · ${value.bytes.length} bytes restored.`, 'success') : notice(value.shuffled ? 'Characters unshuffled live. Match the shared alphabet; this is basic obfuscation with no checksum.' : 'Letters and numbers decoded directly. Text is uppercase; this mode has no checksum.'));
      },
      onError: error => { if (current(session)) setReceiveNotice(notice(error.message, 'error')); },
    };
  }
  async function send(packet) {
    if (!packet || active.current) return;
    setSendNotice(null);
    const session = { stop: () => session.resource?.stop() };
    active.current = session; setPhase('sending');
    try {
      session.resource = createTransmitter({ ...settings, segments: packet.segments,
        onProgress: value => { if (current(session)) setPlayback(value); },
        onComplete: () => {
          if (!current(session)) return;
          active.current = null; setPhase('idle');
          setSendNotice(notice(packet.plain ? 'Sound sent. Read the text on the receiving device.' : 'Sound sent. Check the receiving device for verification.'));
        },
      });
      await session.resource.start();
    } catch (error) {
      if (!current(session)) return;
      active.current = null; session.stop(); setPhase('idle'); setPlayback(value => ({ ...value, toneOn: false }));
      setSendNotice(notice(`Unable to play: ${error.message}`, 'error'));
    }
  }
  function stopSending() {
    const session = active.current; if (!session || phase !== 'sending') return;
    active.current = null; session.stop(); setPhase('idle'); setPlayback(value => ({ ...value, toneOn: false }));
    setSendNotice(notice('Transmission stopped. Resend the whole message to restore it.'));
  }
  function stopListening() {
    const session = active.current; if (!session || !['requesting', 'listening'].includes(phase)) return;
    session.decoder?.flush(); active.current = null; session.stop(); setPhase('idle'); setLevel({ amplitude: 0, on: false });
    setReceiveNotice(value => value.type ? value : notice('Microphone released. Received text is shown above; incomplete exact transfers need to be resent.'));
  }
  async function listen() {
    if (active.current) return;
    clear();
    const session = { stop: () => session.resource?.stop() };
    active.current = session; setPhase('requesting'); setReceiveNotice(notice('Requesting microphone access…'));
    try {
      session.decoder = createMessageDecoder({ wpm: settings.wpm, mode: receiveMode, shuffle, code, ...messageCallbacks(session) });
      session.resource = createMicrophoneReceiver({ ...settings, decoder: session.decoder,
        onLevel: value => { if (current(session)) setLevel(value); },
        onSuspended: () => { if (current(session)) setReceiveNotice(notice('Audio paused by the browser. Keep the page active; stop and restart listening if needed.', 'error')); },
        onDisconnected: () => {
          if (!current(session)) return;
          active.current = null; session.stop(); setPhase('idle'); setLevel({ amplitude: 0, on: false });
          setReceiveNotice(notice('The microphone disconnected. Restart listening.', 'error'));
        },
      });
      const ready = await session.resource.start();
      if (!current(session) || !ready) return;
      setPhase('listening');
      setReceiveNotice(notice(`Listening for ${receiveMode === 'plain' ? shuffle ? 'shuffled text' : 'direct text' : 'a file / exact Unicode transfer'}. Match sender settings and keep this page active.`));
    } catch (error) {
      if (!current(session)) return;
      active.current = null; session.stop(); setPhase('idle'); setLevel({ amplitude: 0, on: false });
      setReceiveNotice(notice(error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow access in the browser and try again.' : error.message, 'error'));
    }
  }
  async function selfTest() {
    if (active.current) return;
    clear();
    const session = { cancelled: false, stop: () => { session.cancelled = true; } };
    active.current = session; setPhase('testing'); setReceiveNotice(notice('Testing generated audio through the tone detector and decoder…'));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      await runAudioSelfTest({ ...settings, mode: receiveMode, shuffle, code, ...messageCallbacks(session), cancelled: () => !current(session) });
      if (current(session)) setReceiveNotice(notice(`Audio self-test passed: ${shuffle ? 'shared alphabet reversed; ' : ''}${receiveMode === 'plain' ? 'letters and numbers decoded live' : 'original Unicode text restored with checksum'}. Physical two-device testing is still needed.`, 'success'));
    } catch (error) { if (current(session)) setReceiveNotice(notice(error.message, 'error')); }
    if (current(session)) { active.current = null; setPhase('idle'); }
  }
  return { phase, sendNotice, resetSendNotice: () => setSendNotice(null), receiveNotice, playback, level, signal, result, clear, send, stopSending, listen, stopListening, selfTest };
}
