import { useState, useEffect } from 'react';
import { subscribeToasts, dismissToast, type ToastOptions } from '../../lib/toast';
import styles from './Toaster.module.css';

export function Toaster() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon} aria-hidden>
            {t.type === 'loading' ? '◌' : t.type === 'success' ? '✓' : '!'}
          </span>
          <span className={styles.message}>{t.message}</span>
          {t.type === 'error' && t.onRetry && (
            <button className={styles.retryBtn} onClick={t.onRetry}>Retry</button>
          )}
          {t.type !== 'loading' && (
            <button
              className={styles.dismissBtn}
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >✕</button>
          )}
        </div>
      ))}
    </div>
  );
}
