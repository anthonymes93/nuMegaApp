import { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Btn } from '../ui/FormField';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { classify } from '../../lib/classifier';
import { uploadImages, formatBytes } from '../../lib/uploadImages';
import { toast, dismissToast } from '../../lib/toast';
import type { InboxItem } from '../../types';
import styles from './QuickCapture.module.css';

const MAX_CAPTURE_LENGTH = 500;
const MAX_IMAGES = 20;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

interface ImageEntry {
  id: string;
  file: File;
  previewUrl: string;
}

type AddFn = (data: Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ id: string }>;
type UpdateFn = (id: string, data: Partial<InboxItem>) => Promise<unknown>;

async function runCaptureSave(
  payload: Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>,
  files: File[],
  toastId: string,
  add: AddFn,
  update: UpdateFn,
): Promise<void> {
  toast({ id: toastId, message: 'Saving…', type: 'loading' });
  try {
    const docRef = await add(payload);
    if (files.length > 0) {
      try {
        const attachments = await uploadImages(docRef.id, files);
        await update(docRef.id, { imageAttachments: attachments } as Partial<InboxItem>);
      } catch {
        toast({ id: toastId, message: 'Text saved — image upload failed.', type: 'error' });
        return;
      }
    }
    toast({ id: toastId, message: 'Captured successfully.', type: 'success' });
  } catch {
    toast({
      id: toastId,
      message: 'Capture failed. Tap to retry.',
      type: 'error',
      onRetry: () => {
        dismissToast(toastId);
        void runCaptureSave(payload, files, toastId, add, update);
      },
    });
  }
}

export function QuickCapture({ hideTrigger = false }: { hideTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [body, setBody] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { add, update } = useCollection<InboxItem>(COLLECTIONS.INBOX);

  const classification = useMemo(
    () => (rawInput.trim().length > 2 ? classify(rawInput) : null),
    [rawInput]
  );

  const totalSize = useMemo(
    () => images.reduce((sum, e) => sum + e.file.size, 0),
    [images]
  );

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('megaapp:open-capture', handler as EventListener);
    return () => window.removeEventListener('megaapp:open-capture', handler as EventListener);
  }, []);

  function revokeAll(entries: ImageEntry[]) {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
  }

  function handleClose() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setImages((prev) => { revokeAll(prev); return []; });
    setOpen(false);
    setRawInput('');
    setBody('');
    setShowDetails(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;

    setImages((prev) => {
      const slots = MAX_IMAGES - prev.length;
      if (slots <= 0) return prev;
      const newEntries = files.slice(0, slots).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...newEntries];
    });
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  function handleSave() {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    // Snapshot File objects before handleClose revokes the blob preview URLs
    const captureFiles = images.map(e => e.file);
    const payload = {
      title: trimmed,
      rawInput: trimmed,
      body: body.trim(),
      type: 'unclassified' as const,
      possibleType: classification?.possibleType ?? 'unclassified',
      confidence: classification?.confidence ?? 'low',
      tags: classification?.tags ?? [],
      contextType: 'general' as const,
      status: 'captured' as const,
      urgency: 'low' as const,
    } as Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>;

    // Close immediately — save continues in background
    handleClose();
    void runCaptureSave(payload, captureFiles, `capture-${Date.now()}`, add, update);
  }

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

          <div className={styles.attachArea}>
            {images.length > 0 && (
              <div className={styles.thumbRow}>
                {images.map((entry) => (
                  <div key={entry.id} className={styles.thumb}>
                    <img src={entry.previewUrl} alt={entry.file.name} />
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      onClick={() => removeImage(entry.id)}
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
              <Btn onClick={handleSave} disabled={!rawInput.trim()}>
                Capture ↵
              </Btn>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
