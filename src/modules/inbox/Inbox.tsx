import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { addDocument, COLLECTIONS } from '../../lib/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip, UrgencyChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { InboxItem, Idea, Task, Resource, Decision, Experiment, Goal, Venture } from '../../types';
import styles from './Inbox.module.css';

const STATUS_TABS = ['captured', 'reviewed', 'converted', 'archived'] as const;

export function Inbox() {
  const { items, update } = useCollection<InboxItem>(COLLECTIONS.INBOX);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('captured');
  const [editing, setEditing] = useState<InboxItem | null>(null);
  const [converting, setConverting] = useState<InboxItem | null>(null);

  const filtered = items.filter((i) => i.status === activeTab);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inbox</h1>
        <p className={styles.subtitle}>Everything captured, waiting to be classified and moved forward.</p>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => {
          const count = items.filter((i) => i.status === tab).length;
          return (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab} {count > 0 && <span className={styles.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📥"
          title={`No ${activeTab} items`}
          description={
            activeTab === 'captured'
              ? 'Use the capture bar at the top to add thoughts, ideas, tasks, and resources.'
              : `No items with status "${activeTab}" yet.`
          }
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onConvert={() => setConverting(item)}
              onStatusChange={(status) => update(item.id, { status })}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => { update(editing.id, data); setEditing(null); }}
        />
      )}

      {converting && (
        <ConvertModal
          item={converting}
          onClose={() => setConverting(null)}
          onConverted={() => { update(converting.id, { status: 'converted' }); setConverting(null); }}
        />
      )}
    </div>
  );
}

function InboxCard({
  item,
  onEdit,
  onConvert,
  onStatusChange,
}: {
  item: InboxItem;
  onEdit: () => void;
  onConvert: () => void;
  onStatusChange: (s: InboxItem['status']) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardMeta}>
          <UrgencyChip urgency={item.urgency} />
          <StatusChip status={item.type} />
          <span className={styles.context}>{item.contextType}</span>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {item.status !== 'converted' && item.status !== 'archived' && (
            <button className={styles.actionBtn} onClick={onConvert}>Convert →</button>
          )}
          {item.status === 'captured' && (
            <button className={styles.actionBtn} onClick={() => onStatusChange('reviewed')}>
              Mark Reviewed
            </button>
          )}
          {item.status !== 'archived' && (
            <button className={`${styles.actionBtn} ${styles.archiveBtn}`} onClick={() => onStatusChange('archived')}>
              Archive
            </button>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>{item.title}</h3>
      {item.body && <p className={styles.cardBody}>{item.body}</p>}
      {item.nextMove && (
        <div className={styles.nextMove}>
          <span className={styles.nextLabel}>Next Move:</span> {item.nextMove}
        </div>
      )}
      {item.source && <div className={styles.source}>Source: {item.source}</div>}
    </div>
  );
}

function EditModal({
  item,
  onClose,
  onSave,
}: {
  item: InboxItem;
  onClose: () => void;
  onSave: (data: Partial<InboxItem>) => void;
}) {
  const [form, setForm] = useState({
    title: item.title,
    body: item.body || '',
    type: item.type,
    contextType: item.contextType,
    urgency: item.urgency,
    nextMove: item.nextMove || '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title="Edit Inbox Item">
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <FormField label="Details">
          <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="unclassified">Unclassified</option>
              <option value="idea">Idea</option>
              <option value="task">Task</option>
              <option value="resource">Resource</option>
              <option value="decision">Decision</option>
              <option value="experiment">Experiment</option>
              <option value="goal">Goal</option>
              <option value="venture_note">Venture Note</option>
            </Select>
          </FormField>
          <FormField label="Urgency">
            <Select value={form.urgency} onChange={(e) => set('urgency', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Context">
            <Select value={form.contextType} onChange={(e) => set('contextType', e.target.value)}>
              {CONTEXT_OPTIONS}
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="What's the immediate next step?" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(form as Partial<InboxItem>)} disabled={!form.title.trim()}>Save</Btn>
        </FormActions>
      </div>
    </Modal>
  );
}

const CONTEXT_OPTIONS = (
  <>
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
  </>
);

type ConvertTarget = 'idea' | 'task' | 'resource' | 'decision' | 'experiment' | 'goal' | 'venture_note';

function ConvertModal({
  item,
  onClose,
  onConverted,
}: {
  item: InboxItem;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [target, setTarget] = useState<ConvertTarget>('idea');
  const [saving, setSaving] = useState(false);

  async function handleConvert() {
    setSaving(true);
    const ts = serverTimestamp();
    const base = { createdAt: ts, updatedAt: ts };

    if (target === 'idea') {
      await addDocument(COLLECTIONS.IDEAS, {
        title: item.title,
        description: item.body || '',
        contextType: item.contextType,
        status: 'raw',
        potential: 'medium',
        nextMove: item.nextMove || '',
        ...base,
      } as Omit<Idea, 'id'>);
    } else if (target === 'task') {
      await addDocument(COLLECTIONS.TASKS, {
        title: item.title,
        notes: item.body || '',
        status: 'todo',
        priority: item.urgency === 'high' ? 'high' : item.urgency === 'medium' ? 'medium' : 'low',
        ...base,
      } as Omit<Task, 'id'>);
    } else if (target === 'resource') {
      await addDocument(COLLECTIONS.RESOURCES, {
        title: item.title,
        url: '',
        notes: item.body || '',
        resourceType: 'other',
        status: 'saved',
        contextType: item.contextType,
        nextMove: item.nextMove || '',
        ...base,
      } as Omit<Resource, 'id'>);
    } else if (target === 'decision') {
      await addDocument(COLLECTIONS.DECISIONS, {
        title: item.title,
        decision: item.body || item.title,
        reasoning: '',
        contextType: item.contextType,
        status: 'active',
        ...base,
      } as Omit<Decision, 'id'>);
    } else if (target === 'experiment') {
      await addDocument(COLLECTIONS.EXPERIMENTS, {
        title: item.title,
        hypothesis: item.body || '',
        status: 'idea',
        nextMove: item.nextMove || '',
        ...base,
      } as Omit<Experiment, 'id'>);
    } else if (target === 'goal') {
      await addDocument(COLLECTIONS.GOALS, {
        title: item.title,
        description: item.body || '',
        horizon: 'month',
        status: 'active',
        nextMove: item.nextMove || '',
        ...base,
      } as Omit<Goal, 'id'>);
    } else if (target === 'venture_note') {
      await addDocument(COLLECTIONS.VENTURES, {
        name: item.title,
        description: item.body || '',
        status: 'seed',
        category: 'other',
        currentFocus: '',
        nextMove: item.nextMove || '',
        ...base,
      } as Omit<Venture, 'id'>);
    }

    onConverted();
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title="Convert Inbox Item" width={440}>
      <div className={styles.form}>
        <p className={styles.convertTitle}>"{item.title}"</p>
        <FormField label="Convert to">
          <Select value={target} onChange={(e) => setTarget(e.target.value as ConvertTarget)}>
            <option value="idea">Idea</option>
            <option value="task">Task</option>
            <option value="resource">Resource</option>
            <option value="decision">Decision</option>
            <option value="experiment">Experiment</option>
            <option value="goal">Goal</option>
            <option value="venture_note">Venture</option>
          </Select>
        </FormField>
        <p className={styles.convertHint}>
          The item will be created with pre-filled fields. You can edit it after conversion.
        </p>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleConvert} disabled={saving}>
            {saving ? 'Converting…' : `Convert to ${target} →`}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
