export function Status({ id, message, type = '' }) {
  return <div id={id} className={`status ${type}`} role="status" aria-live="polite">{message}</div>;
}
export function CardHeading({ number, title, id, arrow }) {
  return <div className="card-heading"><div><p className="eyebrow">{number} / {number === '01' ? 'TRANSMIT' : 'RECEIVE'}</p><h2 id={id}>{title}</h2></div><span className="round-icon" aria-hidden="true">{arrow}</span></div>;
}
export function SharedSettings({ settings, onChange, disabled }) {
  return <section className="settings" aria-label="Shared audio settings">
    <div className="settings-caption"><span className="small-dot" /><strong>Match on both devices</strong><span>Start at 20–30 WPM in a quiet room.</span></div>
    <label htmlFor="speed">Speed <select id="speed" value={settings.wpm} disabled={disabled} onChange={event => onChange('wpm', Number(event.target.value))}>{[10, 20, 30, 40, 50].map(speed => <option key={speed} value={speed}>{speed} WPM{speed === 50 ? ' · experimental' : ''}</option>)}</select></label>
    <label htmlFor="frequency">Tone <select id="frequency" value={settings.frequency} disabled={disabled} onChange={event => onChange('frequency', Number(event.target.value))}>{[550, 700, 900].map(tone => <option key={tone} value={tone}>{tone} Hz</option>)}</select></label>
  </section>;
}
