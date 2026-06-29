import { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Btn } from '../ui/FormField';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { classify } from '../../lib/classifier';
import { uploadImages, formatBytes } from '../../lib/uploadImages';
import type { InboxItem } from '../../types';
import styles from './QuickCapture.module.css';

const MAX_CAPTURE_LENGTH = 500;
const MAX_IMAGES = 20;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

export function QuickCapture({ hideTrigger = false }: { hideTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [body, setBody] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { add, update } = useCollection<InboxItem>(COLLECTIONS.INBOX);

  const classification = useMemo(
    () => (rawInput.trim().length > 2 ? classify(rawInput) : null),
    [rawInput]
  );

  const totalSize = useMemo(
    () => images.reduce((sum, f) => sum + f.size, 0),
    [images]
  );

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('megaapp:open-capture', handler as EventListener);
    return () => window.removeEventListener('megaapp:open-capture', handler as EventListener);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const prevPreviewUrls = useRef<string[]>([]);;

  function handleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(false);
    setSaved(false);
    setRawInput('');
    setBody('');
    setShowDetails(false);
    setSaving(false);
    setImages([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImages((prev) => {
      const combined = [...prev, ...files];
      return combined.slice(0, MAX_IMAGES);
    });
    // Reset so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmed = rawInput.trim();
    if (!trimmed || saving || saved) return;
    setSaving(true);
    setUploadError(null);
    let hadUploadError = false;
    try {
      const docRef = await add({
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

      if (images.length > 0) {
        try {
          const attachments = await uploadImages(docRef.id, images);
          await update(docRef.id, { imageAttachments: attachments } as Partial<InboxItem>);
        } catch {
          hadUploadError = true;
          setUploadError('Item saved — but image upload failed. Try again from Inbox.');
        }
      }

      setSaved(true);
      if (!hadUploadError) {
        closeTimerRef.current = setTimeout(handleClose, 600);
      }
    } catch {
      // Firestore error — let user retry
    } finally {
      setSaving(false);
    }
  }

  // Revoke previous batch and create fresh object URLs whenever images changes
  const previews = useMemo(() => {
    prevPreviewUrls.current.forEach((u) => URL.revokeObjectURL(u));
    const result = images.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    prevPreviewUrls.current = result.map((r) => r.url);
    return result;
  }, [images]);

  return (
    <>
      {!hideTrigger && (
        <button className={styles.trigger} onClick={() => setOpen(true)}>
          <span className={styles.triggerPlus}>+</span>
          <span className={styles.triggerText}>Capture…</span>
          <span className={styles.triggerKbd}>⌘K</span>
        </button>
      )}

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

          {/* Image attachments */}
          <div className={styles.attachArea}>
            {previews.length > 0 && (
              <div className={styles.thumbRow}>
                {previews.map((p, i) => (
                  <div key={i} className={styles.thumb}>
                    <img src={p.url} alt={p.name} />
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      onClick={() => removeImage(i)}
                      title="Remove"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.attachBottom}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                title={images.length >= MAX_IMAGES ? 'Maximum 20 images' : 'Attach images'}
              >
                {images.length === 0 ? '⊕ Attach images' : `⊕ Add more (${images.length}/${MAX_IMAGES})`}
              </button>
              {images.length > 0 && (
                <span className={styles.attachMeta}>
                  {images.length} {images.length === 1 ? 'image' : 'images'} · {formatBytes(totalSize)}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </div>

          {uploadError && (
            <p className={styles.uploadError}>{uploadError}</p>
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
                {saved
                  ? (uploadError ? '✓ Text saved' : '✓ Captured')
                  : saving
                    ? (images.length > 0 ? 'Uploading…' : 'Saving…')
                    : 'Capture ↵'}
              </Btn>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
