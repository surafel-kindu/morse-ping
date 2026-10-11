import { useEffect, useState } from 'react';
import { prepareQrInput } from '../lib/qr-transfer.mjs';
export function usePreparedQr(input) {
  const { inputKind, text, file, shuffle, code } = input;
  const [state, setState] = useState({ transfer: null, loading: true, error: '' });
  useEffect(() => {
    let cancelled = false;
    setState({ transfer: null, loading: true, error: '' });
    prepareQrInput(input).then(transfer => { if (!cancelled) setState({ transfer, loading: false, error: '', inputKind, text, file, shuffle, code }); }, error => { if (!cancelled) setState({ transfer: null, loading: false, error: error.message, inputKind, text, file, shuffle, code }); });
    return () => { cancelled = true; };
  }, [inputKind, text, file, shuffle, code]);
  return state.inputKind === inputKind && state.text === text && state.file === file && state.shuffle === shuffle && state.code === code ? state : { transfer: null, loading: true, error: '' };
}
