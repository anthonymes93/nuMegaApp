import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Venture, VentureStatus, Task, Idea, Experiment, Goal } from '../../types';
import styles from './Ventures.module.css';

const STATUSES: VentureStatus[] = ['seed', 'active', 'validating', 'launched', 'paused'];

export function Ventures() {
  const { items, add, update } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Venture | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = items.filter((v) => v.status !== 'archived');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ventures</h1>
          <p className={styles.subtitle}>Projects and initiatives you're running.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Venture</Btn>
      </div>

      {STATUSES.map((status) => {
        const group = active.filter((v) => v.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status} className={styles.group}>
            <div className={styles.groupHeader}>
              <StatusChip status={status} />
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            <div className={styles.list}>
              {group.map((v) => (
                <VentureCard
                  key={v.id}
                  venture={v}
                  isExpanded={expanded === v.id}
                  onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                  onEdit={() => setEditing(v)}
                  onUpdate={(d) => update(v.id, d)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {active.length === 0 && (
        <EmptyState
          icon="🚀"
          title="No ventures yet"
          description="Create your first venture to track a project, product, or initiative."
          action={{ label: '+ New Venture', onClick: () => setShowForm(true) }}
        />
      )}

      {(showForm || editing) && (
        <VentureModal
          venture={editing || undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Venture, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function VentureCard({
  venture,
  isExpanded,
  onToggle,
  onEdit,
  onUpdate,
}: {
  venture: Venture;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (d: Partial<Venture>) => void;
}) {
  const { items: tasks } = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: ideas } = useCollection<Idea>(COLLECTIONS.IDEAS);
  const { items: experiments } = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);
  const { items: goals } = useCollection<Goal>(COLLECTIONS.GOALS);

  const relTasks = tasks.filter((t) => t.relatedId === venture.id);
  const relIdeas = ideas.filter((i) => i.relatedVentureId === venture.id);
  const relExp = experiments.filter((e) => e.relatedVentureId === venture.id);
  const relGoals = goals.filter((g) => g.relatedVentureId === venture.id);

  const { add: addTask } = useCollection<Task>(COLLECTIONS.TASKS);
  const [quickTask, setQuickTask] = useState('');

  async function addQuickTask() {
    if (!quickTask.trim()) return;
    await addTask({
      title: quickTask.trim(),
      status: 'todo',
      priority: 'medium',
      relatedType: 'venture',
      relatedId: venture.id,
      notes: '',
    } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
    setQuickTask('');
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardMain} onClick={onToggle}>
        <div className={styles.cardLeft}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardName}>{venture.name}</h3>
            <StatusChip status={venture.category} />
          </div>
          {venture.description && <p className={styles.cardDesc}>{venture.description}</p>}
          {venture.currentFocus && (
            <div className={styles.focus}>Focus: {venture.currentFocus}</div>
          )}
          {venture.nextMove && <div className={styles.next}>→ {venture.nextMove}</div>}
        </div>
        <div className={styles.cardRight}>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
          <div className={styles.relCounts}>
            {relTasks.length > 0 && <span className={styles.relBadge}>{relTasks.length} tasks</span>}
            {relIdeas.length > 0 && <span className={styles.relBadge}>{relIdeas.length} ideas</span>}
          </div>
          <span className={styles.expand}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.expanded}>
          <div className={styles.expandedSections}>
            <RelSection title="Tasks" items={relTasks.map((t) => ({ id: t.id, title: t.title, sub: t.status }))} />
            <RelSection title="Ideas" items={relIdeas.map((i) => ({ id: i.id, title: i.title, sub: i.status }))} />
            <RelSection title="Experiments" items={relExp.map((e) => ({ id: e.id, title: e.title, sub: e.status }))} />
            <RelSection title="Goals" items={relGoals.map((g) => ({ id: g.id, title: g.title, sub: g.horizon }))} />
          </div>
          <div className={styles.quickAdd}>
            <input
              className={styles.quickInput}
              placeholder="Quick add task…"
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addQuickTask(); }}
            />
            <button className={styles.quickBtn} onClick={addQuickTask}>Add Task</button>
          </div>
          <div className={styles.statusRow}>
            {(['seed','active','validating','launched','paused','archived'] as VentureStatus[]).map((s) => (
              <button
                key={s}
                className={`${styles.statusBtn} ${venture.status === s ? styles.statusActive : ''}`}
                onClick={(e) => { e.stopPropagation(); onUpdate({ status: s }); }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RelSection({ title, items }: { title: string; items: { id: string; title: string; sub: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.relSection}>
      <span className={styles.relTitle}>{title}</span>
      <div className={styles.relItems}>
        {items.map((i) => (
          <div key={i.id} className={styles.relItem}>
            <span className={styles.relItemTitle}>{i.title}</span>
            <StatusChip status={i.sub} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VentureModal({
  venture,
  onClose,
  onSave,
}: {
  venture?: Venture;
  onClose: () => void;
  onSave: (data: Partial<Venture>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: venture?.name || '',
    description: venture?.description || '',
    status: venture?.status || 'seed',
    category: venture?.category || 'other',
    currentFocus: venture?.currentFocus || '',
    nextMove: venture?.nextMove || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form as Partial<Venture>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={venture ? 'Edit Venture' : 'New Venture'}>
      <div className={styles.form}>
        <FormField label="Name" required>
          <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Venture name" />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="seed">Seed</option>
              <option value="active">Active</option>
              <option value="validating">Validating</option>
              <option value="launched">Launched</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
          <FormField label="Category">
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="software">Software</option>
              <option value="service">Service</option>
              <option value="content">Content</option>
              <option value="contractor">Contractor</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Current Focus">
          <Input value={form.currentFocus} onChange={(e) => set('currentFocus', e.target.value)} placeholder="What are you focused on right now?" />
        </FormField>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="What's the immediate next step?" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving…' : 'Save Venture'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
