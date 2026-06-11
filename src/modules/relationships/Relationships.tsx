import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Relationship, Venture } from '../../types';
import styles from './Relationships.module.css';

function tsToDate(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '';
  const ms = (ts as { toMillis?: () => number }).toMillis?.();
  if (!ms) return '';
  return new Date(ms).toISOString().split('T')[0];
}

function dateToTs(s: string): Timestamp | undefined {
  if (!s) return undefined;
  return Timestamp.fromDate(new Date(s));
}

export function Relationships() {
  const { items, add, update, remove } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [editing, setEditing] = useState<Relationship | null>(null);
  const [adding, setAdding] = useState(false);

  const activeVentures = ventures.filter((v) => v.status !== 'archived');

  function ventureName(id?: string) {
    if (!id) return null;
    return ventures.find((v) => v.id === id)?.name ?? null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Relationships</h1>
          <p className={styles.subtitle}>People who matter — contacts, connectors, collaborators.</p>
        </div>
        <Btn onClick={() => setAdding(true)}>+ Add</Btn>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No relationships yet. Capture contacts from the inbox or add directly.</p>
      ) : (
        <div className={styles.list}>
          {items.map((rel) => (
            <div key={rel.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardLeft}>
                  <span className={styles.name}>{rel.name}</span>
                  {rel.role && <span className={styles.role}>{rel.role}</span>}
                  {rel.relatedVentureId && (
                    <span className={styles.venture}>{ventureName(rel.relatedVentureId)}</span>
                  )}
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => setEditing(rel)}>Edit</button>
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => remove(rel.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {rel.notes && <p className={styles.notes}>{rel.notes}</p>}
              {rel.nextAction && (
                <p className={styles.nextAction}>
                  <span className={styles.nextLabel}>Follow up:</span> {rel.nextAction}
                  {rel.nextActionDate && (
                    <span className={styles.nextDate}> · {tsToDate(rel.nextActionDate)}</span>
                  )}
                </p>
              )}
              {rel.tags && rel.tags.length > 0 && (
                <div className={styles.tags}>
                  {rel.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <RelationshipModal
          initial={editing ?? undefined}
          ventures={activeVentures}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) {
              await update(editing.id, data);
            } else {
              await add(data as Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>);
            }
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RelationshipModal({
  initial,
  ventures,
  onClose,
  onSave,
}: {
  initial?: Relationship;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Relationship>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    notes: initial?.notes ?? '',
    nextAction: initial?.nextAction ?? '',
    nextActionDate: tsToDate(initial?.nextActionDate),
    relatedVentureId: initial?.relatedVentureId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      notes: form.notes.trim() || undefined,
      nextAction: form.nextAction.trim() || undefined,
      nextActionDate: dateToTs(form.nextActionDate),
      relatedVentureId: form.relatedVentureId || undefined,
    });
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit Relationship' : 'Add Relationship'}>
      <div className={styles.form}>
        <FormRow>
          <FormField label="Name" required>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Person's name"
            />
          </FormField>
          <FormField label="Role / What they do">
            <Input
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              placeholder="e.g. knows roofing contractors"
            />
          </FormField>
        </FormRow>
        <FormField label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Context about this person"
          />
        </FormField>
        <FormRow>
          <FormField label="Follow-up / Next action">
            <Input
              value={form.nextAction}
              onChange={(e) => set('nextAction', e.target.value)}
              placeholder="What do you need to do with this contact?"
            />
          </FormField>
          <FormField label="Follow-up date">
            <Input
              type="date"
              value={form.nextActionDate}
              onChange={(e) => set('nextActionDate', e.target.value)}
            />
          </FormField>
        </FormRow>
        <FormField label="Venture">
          <Select value={form.relatedVentureId} onChange={(e) => set('relatedVentureId', e.target.value)}>
            <option value="">No venture</option>
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
