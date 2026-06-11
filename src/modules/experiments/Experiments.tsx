import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Experiment, ExperimentStatus, Venture } from '../../types';
import styles from './Experiments.module.css';

const STATUSES: ExperimentStatus[] = ['idea', 'running', 'completed', 'abandoned'];

export function Experiments() {
  const { items, add, update } = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Experiment | null>(null);

  const active = items.filter((e) => !['archived'].includes(e.status as string));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Experiments</h1>
          <p className={styles.subtitle}>Hypotheses worth testing. Results worth learning from.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Experiment</Btn>
      </div>

      {STATUSES.map((status) => {
        const group = active.filter((e) => e.status === status);
        return (
          <div key={status} className={styles.group}>
            <div className={styles.groupHeader}>
              <StatusChip status={status} />
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            {group.length === 0 ? (
              <p className={styles.emptyGroup}>No {status} experiments.</p>
            ) : (
              <div className={styles.grid}>
                {group.map((exp) => (
                  <ExperimentCard
                    key={exp.id}
                    experiment={exp}
                    ventures={ventures}
                    onEdit={() => setEditing(exp)}
                    onUpdate={(d) => update(exp.id, d)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {active.length === 0 && (
        <EmptyState
          icon="🧪"
          title="No experiments yet"
          description="Turn ideas into hypotheses and run experiments to validate them."
          action={{ label: '+ New Experiment', onClick: () => setShowForm(true) }}
        />
      )}

      {(showForm || editing) && (
        <ExperimentModal
          experiment={editing || undefined}
          ventures={ventures}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExperimentCard({ experiment, ventures, onEdit, onUpdate }: {
  experiment: Experiment;
  ventures: Venture[];
  onEdit: () => void;
  onUpdate: (d: Partial<Experiment>) => void;
}) {
  const venture = ventures.find((v) => v.id === experiment.relatedVentureId);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.chips}>
          {venture && <span className={styles.venture}>{venture.name}</span>}
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {experiment.status === 'idea' && (
            <button className={styles.runBtn} onClick={() => onUpdate({ status: 'running' })}>▶ Run</button>
          )}
          {experiment.status === 'running' && (
            <button className={styles.completeBtn} onClick={() => onUpdate({ status: 'completed' })}>✓ Complete</button>
          )}
          {experiment.status === 'running' && (
            <button className={styles.abandonBtn} onClick={() => onUpdate({ status: 'abandoned' })}>Abandon</button>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>{experiment.title}</h3>
      <div className={styles.hypothesis}>
        <span className={styles.hypoLabel}>Hypothesis:</span>
        <span className={styles.hypoText}>{experiment.hypothesis}</span>
      </div>
      {experiment.result && (
        <div className={styles.result}>
          <span className={styles.resultLabel}>Result:</span> {experiment.result}
        </div>
      )}
      {experiment.nextMove && <div className={styles.next}>→ {experiment.nextMove}</div>}
      <div className={styles.statusRow}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`${styles.statusBtn} ${experiment.status === s ? styles.statusActive : ''}`}
            onClick={() => onUpdate({ status: s })}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExperimentModal({ experiment, ventures, onClose, onSave }: {
  experiment?: Experiment;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Experiment>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: experiment?.title || '',
    hypothesis: experiment?.hypothesis || '',
    status: experiment?.status || 'idea',
    result: experiment?.result || '',
    relatedVentureId: experiment?.relatedVentureId || '',
    nextMove: experiment?.nextMove || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim() || !form.hypothesis.trim()) return;
    setSaving(true);
    await onSave({ ...form, relatedVentureId: form.relatedVentureId || undefined, result: form.result || undefined } as Partial<Experiment>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={experiment ? 'Edit Experiment' : 'New Experiment'}>
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What are you testing?" />
        </FormField>
        <FormField label="Hypothesis" required>
          <Textarea value={form.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} placeholder="If we do X, we expect Y because Z…" />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="idea">Idea</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </Select>
          </FormField>
          <FormField label="Related Venture">
            <Select value={form.relatedVentureId} onChange={(e) => set('relatedVentureId', e.target.value)}>
              <option value="">None</option>
              {ventures.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </FormField>
        </FormRow>
        {(form.status === 'completed' || form.status === 'abandoned') && (
          <FormField label="Result">
            <Textarea value={form.result} onChange={(e) => set('result', e.target.value)} placeholder="What did you learn?" />
          </FormField>
        )}
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="What's the next step?" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.title.trim() || !form.hypothesis.trim() || saving}>
            {saving ? 'Saving…' : 'Save Experiment'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
