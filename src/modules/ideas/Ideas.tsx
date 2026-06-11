import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Idea, IdeaStatus, ContextType, Experiment } from '../../types';
import styles from './Ideas.module.css';

const STATUSES: IdeaStatus[] = ['raw', 'thinking', 'testing', 'launching', 'parked'];

export function Ideas() {
  const { items, add, update } = useCollection<Idea>(COLLECTIONS.IDEAS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);

  const activeItems = items.filter((i) => i.status !== 'archived');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ideas</h1>
          <p className={styles.subtitle}>Raw sparks to launching experiments.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Idea</Btn>
      </div>

      {STATUSES.map((status) => {
        const group = activeItems.filter((i) => i.status === status);
        return (
          <div key={status} className={styles.group}>
            <div className={styles.groupHeader}>
              <StatusChip status={status} />
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            {group.length === 0 ? (
              <p className={styles.emptyGroup}>No {status} ideas.</p>
            ) : (
              <div className={styles.grid}>
                {group.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onEdit={() => setEditing(idea)} onUpdate={(d) => update(idea.id, d)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(showForm || editing) && (
        <IdeaModal
          idea={editing || undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) {
              await update(editing.id, data);
            } else {
              await add(data as Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>);
            }
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function IdeaCard({ idea, onEdit, onUpdate }: { idea: Idea; onEdit: () => void; onUpdate: (d: Partial<Idea>) => void }) {
  const [promoting, setPromoting] = useState(false);
  const { add: addExperiment } = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);

  async function promoteToExperiment() {
    setPromoting(true);
    await addExperiment({
      title: idea.title,
      hypothesis: idea.description || '',
      status: 'idea',
      nextMove: idea.nextMove || '',
    } as Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>);
    await onUpdate({ status: 'testing' });
    setPromoting(false);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.chips}>
          <StatusChip status={idea.potential} />
          <span className={styles.ctx}>{idea.contextType}</span>
        </div>
        <button className={styles.editBtn} onClick={onEdit}>Edit</button>
      </div>
      <h3 className={styles.cardTitle}>{idea.title}</h3>
      {idea.description && <p className={styles.cardDesc}>{idea.description}</p>}
      {idea.nextMove && <div className={styles.next}>→ {idea.nextMove}</div>}
      <div className={styles.cardFooter}>
        <div className={styles.statusRow}>
          {(['raw','thinking','testing','launching','parked'] as IdeaStatus[]).map((s) => (
            <button
              key={s}
              className={`${styles.statusBtn} ${idea.status === s ? styles.statusActive : ''}`}
              onClick={() => onUpdate({ status: s })}
            >
              {s}
            </button>
          ))}
        </div>
        {idea.status !== 'archived' && (
          <div className={styles.actions}>
            <button className={styles.promoteBtn} onClick={promoteToExperiment} disabled={promoting}>
              {promoting ? '…' : '→ Experiment'}
            </button>
            <button className={styles.archiveBtn} onClick={() => onUpdate({ status: 'archived' })}>Archive</button>
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaModal({
  idea,
  onClose,
  onSave,
}: {
  idea?: Idea;
  onClose: () => void;
  onSave: (data: Partial<Idea>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: idea?.title || '',
    description: idea?.description || '',
    contextType: (idea?.contextType || 'general') as ContextType,
    status: (idea?.status || 'raw') as IdeaStatus,
    potential: idea?.potential || 'medium',
    nextMove: idea?.nextMove || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form as Partial<Idea>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={idea ? 'Edit Idea' : 'New Idea'}>
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What's the idea?" />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the idea…" />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="raw">Raw</option>
              <option value="thinking">Thinking</option>
              <option value="testing">Testing</option>
              <option value="launching">Launching</option>
              <option value="parked">Parked</option>
            </Select>
          </FormField>
          <FormField label="Potential">
            <Select value={form.potential} onChange={(e) => set('potential', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Context">
          <Select value={form.contextType} onChange={(e) => set('contextType', e.target.value)}>
            <option value="general">General</option>
            <option value="personal">Personal</option>
            <option value="business">Business</option>
            <option value="anthonyos">AnthonyOS</option>
            <option value="contractor_os">Contractor OS</option>
            <option value="megaapp">MegaApp</option>
            <option value="client">Client</option>
            <option value="learning">Learning</option>
            <option value="health">Health</option>
            <option value="money">Money</option>
          </Select>
        </FormField>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="What moves this forward?" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.title.trim() || saving}>
            {saving ? 'Saving…' : 'Save Idea'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
