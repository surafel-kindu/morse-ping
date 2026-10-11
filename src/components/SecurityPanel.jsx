import { useState } from 'react';
import { generateSecret, normalizeSecret } from '../lib/security.mjs';

export default function SecurityPanel({ enabled, code, disabled, onToggle, onCodeChange, onForget }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  let valid = false;
  try { normalizeSecret(code); valid = true; } catch { /* An incomplete input is expected while typing. */ }
  function generate() {
    try { onCodeChange(generateSecret()); setVisible(true); setError(''); setCopied(false); }
    catch (cause) { setError(cause.message); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setError(''); }
    catch { setError('Copy is unavailable here. Show the code and select it to copy manually.'); }
  }
  return <section className={`security-panel ${enabled ? 'enabled' : ''}`} aria-labelledby="security-heading">
    <div className="security-header"><div><p className="eyebrow">THE SHARED KEY</p><h2 id="security-heading">A secret between devices.</h2></div><label className="security-switch"><input id="secure-mode" type="checkbox" checked={enabled} disabled={disabled} onChange={event => onToggle(event.target.checked)} /> Secure transfer</label></div>
    <p className="helper">{enabled ? 'Encrypted text and files. Enable Secure transfer on both devices and enter the same shared code.' : 'Enable encryption before sending something private. Direct and exact modes send readable content.'}</p>
    {enabled && <div className="security-controls">
      <label className="field-label" htmlFor="shared-code">Shared code <span>{valid ? '32 characters · ready' : 'Generate once, share separately'}</span></label>
      <div className="secret-input"><input id="shared-code" type={visible ? 'text' : 'password'} value={code} maxLength={128} disabled={disabled} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="secret-help" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" onChange={event => { onCodeChange(event.target.value); setError(''); setCopied(false); }} /><button className="secondary" disabled={disabled} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></div>
      <div className="secret-actions"><button id="generate-code" className="secondary" disabled={disabled} onClick={generate}>↻ Generate code</button><button id="copy-code" className="secondary" disabled={disabled || !valid} onClick={copy}>{copied ? 'Copied' : 'Copy code'}</button><button id="forget-code" className="text-button" disabled={disabled || !code} onClick={() => { onForget(); setVisible(false); setError(''); setCopied(false); }}>Forget code &amp; clear result</button></div>
      <p className="helper" id="secret-help">Generate on one device, then enter it on the other. Spaces, dashes, and letter case are ignored. Share in person or through a trusted channel. The code stays in this page’s memory; reloading clears it.</p>
      <div className="cipher-strip" aria-label="Security features"><span>RANDOM SHARED CODE</span><b>→</b><span>ENCRYPTED CHARACTERS</span><b>→</b><span>MORSE SOUND</span></div>
      <p className="helper">Every prepared packet uses fresh randomness. Text, filenames, and file types remain locked until authentication succeeds. Keep the code private; anyone holding it can unlock or create a transfer.</p>
      {error && <p className="status error" role="alert">{error}</p>}
    </div>}
  </section>;
}
