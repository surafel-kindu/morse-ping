import { useState } from 'react';
import Sender from './components/Sender.jsx';
import Receiver from './components/Receiver.jsx';
import SecurityPanel from './components/SecurityPanel.jsx';
import QuickGuide from './components/QuickGuide.jsx';
import { SharedSettings } from './components/Shared.jsx';
import { usePreparedTransfer } from './hooks/usePreparedTransfer.js';
import { useAudioTransfer } from './hooks/useAudioTransfer.js';

function downloadResult(result) {
  const url = URL.createObjectURL(new Blob([result.bytes], { type: result.type || 'application/octet-stream' }));
  const link = document.createElement('a'); link.href = url;
  link.download = result.name.replace(/[\/\\\x00-\x1f]/g, '_') || 'message.txt';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function App() {
  const [inputKind, setInputKind] = useState('text');
  const [text, setText] = useState('Hello from the other side.');
  const [textMode, setTextMode] = useState('plain');
  const [file, setFile] = useState(null);
  const [receiveMode, setReceiveMode] = useState('plain');
  const [settings, setSettings] = useState({ wpm: 30, frequency: 700, threshold: .01 });
  const [guideOpen, setGuideOpen] = useState(false);
  const [secure, setSecure] = useState(true);
  const [code, setCode] = useState('');
  const preparation = usePreparedTransfer({ inputKind, text, mode: secure ? 'secure' : textMode, file, code: secure ? code : '' });
  const audio = useAudioTransfer(settings, secure ? 'secure' : receiveMode, code);
  function inputChange(setter, value) { setter(value); audio.resetSendNotice(); }
  function settingChange(key, value) { setSettings(previous => ({ ...previous, [key]: value })); audio.resetSendNotice(); }
  return <main>
    <header className="topbar"><a className="brand" href="./"><span className="brand-mark" aria-hidden="true">•• —</span> MORSE TRANSFER</a><div className="topbar-links"><span className="tag">BROWSER AUDIO EXPERIMENT</span><a className="guide-link" href="#guide" onClick={() => setGuideOpen(true)}>Read the guide ↗</a></div></header>
    <section className="intro"><div><p className="eyebrow">SPEAKER → AIR → MICROPHONE</p><h1>A little message.<br />A different way to send it.</h1><p className="lede">Turn text or a tiny file into Morse sound. Open this page on a second device to listen and put it back together.</p></div><div className="signal-art" aria-hidden="true"><span>•</span><span>•</span><span>•</span><b>—</b><b>—</b><b>—</b><span>•</span><span>•</span><span>•</span><small>S O S</small></div></section>
    <SharedSettings settings={settings} onChange={settingChange} disabled={audio.phase !== 'idle'} />
    <SecurityPanel enabled={secure} code={code} disabled={audio.phase !== 'idle'} onToggle={value => { setSecure(value); audio.clear(); audio.resetSendNotice(); }} onCodeChange={value => { setCode(value); if (audio.result && !audio.result.locked) audio.clear(); audio.resetSendNotice(); }} onForget={() => { setCode(''); audio.clear(); audio.resetSendNotice(); }} />
    <div className="workspace"><Sender inputKind={inputKind} onKindChange={value => inputChange(setInputKind, value)} text={text} onTextChange={value => inputChange(setText, value)} file={file} onFileChange={value => inputChange(setFile, value)} textMode={secure ? 'secure' : textMode} secure={secure} onModeChange={value => inputChange(setTextMode, value)} preparation={preparation} settings={settings} audio={audio} /><Receiver secure={secure} code={code} mode={secure ? 'secure' : receiveMode} onModeChange={value => { setReceiveMode(value); audio.clear(); }} settings={settings} onThresholdChange={value => settingChange('threshold', value)} audio={audio} onDownload={downloadResult} /></div>
    <section className="how-to" aria-label="How to transfer"><div><span>1</span><p><strong>Open on two devices</strong>Use HTTPS on phones; localhost works for local testing.</p></div><div><span>2</span><p><strong>Listen, then play</strong>Match speed and tone. Keep the devices close and the receiver page active.</p></div><div><span>3</span><p><strong>Read or restore</strong>Text appears live. Secure transfers unlock with your shared code.</p></div></section>
    <QuickGuide open={guideOpen} onToggle={setGuideOpen} />
    <footer><span>Small payloads. Real sound. No upload.</span><span>Built with React · acoustic performance depends on your devices.</span></footer>
  </main>;
}
