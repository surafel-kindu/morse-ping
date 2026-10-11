import { useState } from 'react';
import { SHUFFLE_ALPHABET, createShuffleMapping, generateShuffleCode, swapShuffleMapping } from '../lib/security.mjs';

export default function SecurityPanel({ enabled, code, disabled, onToggle, onCodeChange, onForget, transport = 'morse' }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  let mapping = null;
  try { mapping = createShuffleMapping(code); } catch { /* An incomplete alphabet is expected while typing. */ }
  function change(value) { onCodeChange(value); setError(''); setCopied(false); }
  function generate() {
    try { change(generateShuffleCode()); setVisible(true); }
    catch (cause) { setError(cause.message); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(mapping.alphabet); setCopied(true); setError(''); }
    catch { setError('Copy is unavailable. Show the alphabet and copy it manually.'); }
  }
  return <section className="shuffle-panel" aria-labelledby="security-heading">
    <div className="shuffle-heading"><h2 id="security-heading">Character shuffle</h2><label className="security-switch"><input id="shuffle-mode" type="checkbox" checked={enabled} disabled={disabled} onChange={event => onToggle(event.target.checked)} /> Shuffle on</label></div>
    {enabled ? <>
      <div className="shuffle-controls"><label className="field-label" htmlFor="shared-code">Shared alphabet</label><div className="secret-input"><input id="shared-code" type={visible ? 'text' : 'password'} value={code} maxLength={128} disabled={disabled} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="secret-help" placeholder="A–Z and 0–9 in any order" onChange={event => change(event.target.value)} /><button className="secondary" disabled={disabled} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></div><div className="shuffle-actions"><button id="generate-code" className="secondary" disabled={disabled} onClick={generate}>Shuffle</button><button id="copy-code" className="secondary" disabled={disabled || !mapping} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button><button id="forget-code" className="text-button" disabled={disabled || !code} onClick={() => { onForget(); setVisible(false); setError(''); setCopied(false); }}>Forget</button></div></div>
      <p className="helper" id="secret-help">{mapping ? `A → ${mapping.forward.A} · B → ${mapping.forward.B} · C → ${mapping.forward.C}. ` : 'Generate a shuffle, then share it with the other device. '}Use the same alphabet on both devices. Basic obfuscation; no authentication.</p>
      {mapping && <details className="shuffle-editor"><summary>View or edit character mappings <span>↙</span></summary><p className="helper">Changing a mapping swaps two assignments so every character stays reversible. Copy the updated alphabet to the other device.</p><div className="mapping-grid">{[...SHUFFLE_ALPHABET].map(source => <label key={source}>{source} → <select aria-label={`Replace ${source} with`} value={mapping.forward[source]} disabled={disabled} onChange={event => change(swapShuffleMapping(code, source, event.target.value))}>{[...SHUFFLE_ALPHABET].map(character => <option key={character} value={character}>{character}</option>)}</select></label>)}</div></details>}
      {error && <p className="status error" role="alert">{error}</p>}
    </> : <p className="helper">{transport === 'qr' ? 'QR transfers preserve content with checksums.' : 'Characters go straight to Morse.'} Enable the shuffle on both devices for simple substitution.</p>}
  </section>;
}
