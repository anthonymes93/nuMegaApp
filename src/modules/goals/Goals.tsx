import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Goal, GoalHorizon, Venture } from '../../types';
import styles from './Goals.module.css';

const HORIZONS: GoalHorizon[] = ['today', 'week', 'month', 'quarter', 'year', 'life'];

export function Goals() {
  const { items, add, update } = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const active = items.filter((g) => g.status !== 'archived');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Goals</h1>
          <p className={styles.subtitle}>What you're working toward across every horizon.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Goal</Btn>
      </div>

      {HORIZONS.map((horizon) => {
        const group = active.filter((g) => g.horizon === horizon);
        if (group.length === 0) return null;
        return (
          <div key={horizon} className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.horizon}>{horizon}</span>
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            <div className={styles.list}>
              {group.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  ventures={ventures}
                  onEdit={() => setEditing(goal)}
                  onUpdate={(d) => update(goal.id, d)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {active.length === 0 && (
        <EmptyState
          icon="🎯"
          title="No goals yet"
          description="Add goals across any time horizon — from today to life."
          action={{ label: '+ New Goal', onClick: () => setShowForm(true) }}
        />
      )}

      {(showForm || editing) && (
        <GoalModal
          goal={editing || undefined}
          ventures={ventures}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({ goal, ventures, onEdit, onUpdate }: {
  goal: Goal;
  ventures: Venture[];
  onEdit: () => void;
  onUpdate: (d: Partial<Goal>) => void;
}) {
  const venture = ventures.find((v) => v.id === goal.relatedVentureId);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.chips}>
          <StatusChip status={goal.status} />
          {venture && <span className={styles.venture}>{venture.name}</span>}
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {goal.status === 'active' && (
            <button className={styles.doneBtn} onClick={() => onUpdate({ status: 'completed' })}>✓ Done</button>
          )}
          <button className={styles.archiveBtn} onClick={() => onUpdate({ status: 'archived' })}>Archive</button>
        </div>
      </div>
      <h3 className={styles.cardTitle}>{goal.title}</h3>
      {goal.description && <p className={styles.cardDesc}>{goal.description}</p>}
      {goal.nextMove ? (
        <div className={styles.next}>→ {goal.nextMove}</div>
      ) : (
        <div className={styles.noNext}>No next move — what moves this forward?</div>
      )}
    </div>
  );
}

function GoalModal({ goal, ventures, onClose, onSave }: {
  goal?: Goal;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    horizon: goal?.horizon || 'month',
    status: goal?.status || 'active',
    relatedVentureId: goal?.relatedVentureId || '',
    nextMove: goal?.nextMove || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({ ...form, relatedVentureId: form.relatedVentureId || undefined } as Partial<Goal>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={goal ? 'Edit Goal' : 'New Goal'}>
      <div className={styles.form}>
        <FormField label="Goal" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What do you want to achieve?" />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Horizon">
            <Select value={form.horizon} onChange={(e) => set('horizon', e.target.value)}>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="life">Life</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Related Venture">
          <Select value={form.relatedVentureId} onChange={(e) => set('relatedVentureId', e.target.value)}>
            <option value="">None</option>
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="Concrete next step…" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.title.trim() || saving}>
            {saving ? 'Saving…' : 'Save Goal'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
