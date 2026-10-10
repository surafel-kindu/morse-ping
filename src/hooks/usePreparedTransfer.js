import { useEffect, useState } from 'react';
import { prepareFile, prepareText } from '../lib/transfer.mjs';

export function usePreparedTransfer({ inputKind, text, mode, file }) {
  const [state, setState] = useState({ packet: null, error: '', loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ packet: null, error: '', loading: true });
    (async () => {
      try {
        const packet = inputKind === 'file' ? await prepareFile(file) : prepareText(text, mode);
        if (!cancelled) setState({ packet, error: '', loading: false, inputKind, text, mode, file });
      } catch (error) {
        if (!cancelled) setState({ packet: null, error: error.message, loading: false, inputKind, text, mode, file });
      }
    })();
    return () => { cancelled = true; };
  }, [inputKind, text, mode, file]);
  // Do not expose a packet prepared for old inputs before the next effect runs.
  return state.inputKind === inputKind && state.text === text && state.mode === mode && state.file === file ? state : { packet: null, error: '', loading: true };
}
