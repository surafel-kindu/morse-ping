import { useEffect, useState } from 'react';
import { prepareFile, prepareText, prepareSecureText } from '../lib/transfer.mjs';

export function usePreparedTransfer({ inputKind, text, mode, file, code }) {
  const [state, setState] = useState({ packet: null, error: '', loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ packet: null, error: '', loading: true });
    (async () => {
      try {
        const packet = inputKind === 'file' ? await prepareFile(file, mode === 'secure' ? 'secure' : 'exact', code) : mode === 'secure' ? await prepareSecureText(text, code) : prepareText(text, mode);
        if (!cancelled) setState({ packet, error: '', loading: false, inputKind, text, mode, file, code });
      } catch (error) {
        if (!cancelled) setState({ packet: null, error: error.message, loading: false, inputKind, text, mode, file, code });
      }
    })();
    return () => { cancelled = true; };
  }, [inputKind, text, mode, file, code]);
  // Do not expose a packet prepared for old inputs before the next effect runs.
  return state.inputKind === inputKind && state.text === text && state.mode === mode && state.file === file && state.code === code ? state : { packet: null, error: '', loading: true };
}
