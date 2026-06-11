import { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Btn } from '../ui/FormField';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { classify } from '../../lib/classifier';
import type { InboxItem } from '../../types';
import styles from './QuickCapture.module.css';

const MAX_CAPTURE_LENGTH = 500;

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [body, setBody] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { add } = useCollection<InboxItem>(COLLECTIONS.INBOX);

  const classification = useMemo(
    () => (rawInput.trim().length > 2 ? classify(rawInput) : null),
    [rawInput]
  );

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('megaapp:open-capture', handler as EventListener);
    return () => window.removeEventListener('megaapp:open-capture', handler as EventListener);
  }, []);

  // Cleanup close timer on unmount
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  function handleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(false);
    setSaved(false);
    setRawInput('');
    setBody('');
    setShowDetails(false);
    setSaving(false);
  }

  async function handleSave() {
    const trimmed = rawInput.trim();
    if (!trimmed || saving || saved) return;
    setSaving(true);
    try {
      await add({
        title: trimmed,
        rawInput: trimmed,
        body: body.trim(),
        type: 'unclassified',
        possibleType: classification?.possibleType ?? 'unclassified',
        confidence: classification?.confidence ?? 'low',
        tags: classification?.tags ?? [],
        contextType: 'general',
        status: 'captured',
        urgency: 'low',
      } as Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>);
      setSaved(true);
      closeTimerRef.current = setTimeout(handleClose, 600);
    } catch {
      // Firestore error — let user retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.triggerPlus}>+</span>
        <span className={styles.triggerText}>Capture…</span>
        <span className={styles.triggerKbd}>⌘K</span>
      </button>

      <Modal open={open} onClose={handleClose} title="Capture">
        <div className={styles.form}>
          <textarea
            className={styles.rawInput}
            autoFocus
            placeholder="Capture anything — thought, task, idea, contact, link…"
            value={rawInput}
            rows={2}
            maxLength={MAX_CAPTURE_LENGTH}
            onChange={(e) => setRawInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />

          {rawInput.length > MAX_CAPTURE_LENGTH * 0.9 && (
            <p className={styles.charCount}>
              {rawInput.length} / {MAX_CAPTURE_LENGTH}
            </p>
          )}

          {classification && classification.possibleType !== 'unclassified' && (
            <div className={styles.hint}>
              <span className={styles.hintLabel}>Detected:</span>
              <span className={`${styles.hintType} ${styles[`type_${classification.possibleType}`]}`}>
                {classification.possibleType.replace('_', ' ').toUpperCase()}
              </span>
              <span className={styles.hintDots}>
                {'▪'.repeat(classification.confidence === 'high' ? 3 : classification.confidence === 'medium' ? 2 : 1)}
                {'○'.repeat(classification.confidence === 'high' ? 0 : classification.confidence === 'medium' ? 1 : 2)}
              </span>
              <span className={styles.hintConf}>{classification.confidence}</span>
            </div>
          )}

          {showDetails && (
            <textarea
              className={styles.detailInput}
              placeholder="Context, URL, or additional details…"
              value={body}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
            />
          )}

          <div className={styles.formBottom}>
            <button
              type="button"
              className={styles.detailsToggle}
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? '▲ Less' : '▼ Add context'}
            </button>
            <div className={styles.formActions}>
              <Btn variant="secondary" onClick={handleClose}>Cancel</Btn>
              <Btn
                onClick={handleSave}
                disabled={!rawInput.trim() || saving || saved}
                className={saved ? styles.savedBtn : ''}
              >
                {saved ? '✓ Captured' : saving ? 'Saving…' : 'Capture ↵'}
              </Btn>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
