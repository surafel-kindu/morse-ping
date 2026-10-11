import { useEffect, useState } from 'react';
import { prepareFile, prepareText } from '../lib/transfer.mjs';

export function usePreparedTransfer({ inputKind, text, mode, file, shuffle, code }) {
  const [state, setState] = useState({ packet: null, error: '', loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ packet: null, error: '', loading: true });
    (async () => {
      try {
        const packet = inputKind === 'file' ? await prepareFile(file, { shuffle, code }) : prepareText(text, mode, { shuffle, code });
        if (!cancelled) setState({ packet, error: '', loading: false, inputKind, text, mode, file, shuffle, code });
      } catch (error) {
        if (!cancelled) setState({ packet: null, error: error.message, loading: false, inputKind, text, mode, file, shuffle, code });
      }
    })();
    return () => { cancelled = true; };
  }, [inputKind, text, mode, file, shuffle, code]);
  // Do not expose a packet prepared for old inputs before the next effect runs.
  return state.inputKind === inputKind && state.text === text && state.mode === mode && state.file === file && state.code === code && state.shuffle === shuffle ? state : { packet: null, error: '', loading: true };
}
