import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Decision, ContextType, Venture } from '../../types';
import styles from './Decisions.module.css';

export function Decisions() {
  const { items, add, update } = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null);
  const [filter, setFilter] = useState<'active' | 'reversed' | 'archived' | 'all'>('active');

  const filtered = filter === 'all' ? items : items.filter((d) => d.status === filter);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Decisions</h1>
          <p className={styles.subtitle}>Log decisions so you can remember the why.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Decision</Btn>
      </div>

      <div className={styles.tabs}>
        {(['active', 'reversed', 'archived', 'all'] as const).map((tab) => {
          const count = tab === 'all' ? items.length : items.filter((d) => d.status === tab).length;
          return (
            <button
              key={tab}
              className={`${styles.tab} ${filter === tab ? styles.activeTab : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab} {count > 0 && <span className={styles.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="⚖️"
          title="No decisions logged"
          description="Record decisions with reasoning so you can revisit them later."
          action={{ label: '+ New Decision', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              ventures={ventures}
              onEdit={() => setEditing(d)}
              onUpdate={(data) => update(d.id, data)}
            />
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <DecisionModal
          decision={editing || undefined}
          ventures={ventures}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DecisionCard({ decision, ventures, onEdit, onUpdate }: {
  decision: Decision;
  ventures: Venture[];
  onEdit: () => void;
  onUpdate: (d: Partial<Decision>) => void;
}) {
  const venture = ventures.find((v) => v.id === decision.relatedId && decision.relatedType === 'venture');

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.chips}>
          <StatusChip status={decision.status} />
          <span className={styles.ctx}>{decision.contextType}</span>
          {venture && <span className={styles.venture}>{venture.name}</span>}
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {decision.status === 'active' && (
            <button className={styles.reverseBtn} onClick={() => onUpdate({ status: 'reversed' })}>Reverse</button>
          )}
          {decision.status !== 'archived' && (
            <button className={styles.archiveBtn} onClick={() => onUpdate({ status: 'archived' })}>Archive</button>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>{decision.title}</h3>
      <div className={styles.decisionBox}>
        <span className={styles.decisionLabel}>Decision:</span>
        <p className={styles.decisionText}>{decision.decision}</p>
      </div>
      {decision.reasoning && (
        <div className={styles.reasoning}>
          <span className={styles.reasoningLabel}>Why:</span> {decision.reasoning}
        </div>
      )}
    </div>
  );
}

function DecisionModal({ decision, ventures, onClose, onSave }: {
  decision?: Decision;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Decision>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: decision?.title || '',
    decision: decision?.decision || '',
    reasoning: decision?.reasoning || '',
    contextType: (decision?.contextType || 'general') as ContextType,
    relatedType: decision?.relatedType || '',
    relatedId: decision?.relatedId || '',
    status: decision?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim() || !form.decision.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      relatedType: form.relatedType || undefined,
      relatedId: form.relatedId || undefined,
    } as Partial<Decision>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={decision ? 'Edit Decision' : 'Log Decision'}>
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Short label for this decision" />
        </FormField>
        <FormField label="The Decision" required>
          <Textarea
            value={form.decision}
            onChange={(e) => set('decision', e.target.value)}
            placeholder="What did you decide?"
            rows={2}
          />
        </FormField>
        <FormField label="Reasoning">
          <Textarea
            value={form.reasoning}
            onChange={(e) => set('reasoning', e.target.value)}
            placeholder="Why did you make this choice?"
          />
        </FormField>
        <FormRow>
          <FormField label="Context">
            <Select value={form.contextType} onChange={(e) => set('contextType', e.target.value)}>
              <option value="general">General</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="megaapp">MegaApp</option>
              <option value="contractor_os">Contractor OS</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="reversed">Reversed</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Related Type">
            <Select value={form.relatedType} onChange={(e) => set('relatedType', e.target.value)}>
              <option value="">None</option>
              <option value="venture">Venture</option>
              <option value="goal">Goal</option>
            </Select>
          </FormField>
          {form.relatedType === 'venture' && (
            <FormField label="Venture">
              <Select value={form.relatedId} onChange={(e) => set('relatedId', e.target.value)}>
                <option value="">Select…</option>
                {ventures.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </FormField>
          )}
        </FormRow>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.title.trim() || !form.decision.trim() || saving}>
            {saving ? 'Saving…' : 'Save Decision'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
