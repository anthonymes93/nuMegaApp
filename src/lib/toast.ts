export type ToastType = 'loading' | 'success' | 'error';

export interface ToastOptions {
  id: string;
  message: string;
  type: ToastType;
  onRetry?: () => void;
}

type Listener = (toasts: ToastOptions[]) => void;

const _entries: ToastOptions[] = [];
const _listeners = new Set<Listener>();

function _notify() {
  const snapshot = [..._entries];
  _listeners.forEach(fn => fn(snapshot));
}

export function toast(opts: ToastOptions): void {
  const idx = _entries.findIndex(e => e.id === opts.id);
  if (idx >= 0) {
    _entries[idx] = opts;
  } else {
    _entries.push(opts);
  }
  _notify();

  if (opts.type === 'success') {
    setTimeout(() => dismissToast(opts.id), 3000);
  }
}

export function dismissToast(id: string): void {
  const idx = _entries.findIndex(e => e.id === id);
  if (idx >= 0) {
    _entries.splice(idx, 1);
    _notify();
  }
}

export function subscribeToasts(listener: Listener): () => void {
  _listeners.add(listener);
  listener([..._entries]);
  return () => { _listeners.delete(listener); };
}
