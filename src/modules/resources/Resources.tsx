import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Resource, ResourceType, ContextType } from '../../types';
import styles from './Resources.module.css';

const STATUS_TABS = ['saved', 'studying', 'applied', 'archived'] as const;

export function Resources() {
  const { items, add, update } = useCollection<Resource>(COLLECTIONS.RESOURCES);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('saved');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);

  const filtered = items.filter((r) => r.status === activeTab);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Resources</h1>
          <p className={styles.subtitle}>Articles, tools, courses, books, and prompts worth applying.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ Add Resource</Btn>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => {
          const count = items.filter((r) => r.status === tab).length;
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
          icon="📚"
          title={`No ${activeTab} resources`}
          description={
            activeTab === 'saved'
              ? 'Save articles, tools, books, and courses you want to revisit.'
              : `No resources with status "${activeTab}" yet.`
          }
        />
      ) : (
        <div className={styles.grid}>
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onEdit={() => setEditing(r)}
              onUpdate={(d) => update(r.id, d)}
            />
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <ResourceModal
          resource={editing || undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ResourceCard({ resource, onEdit, onUpdate }: {
  resource: Resource;
  onEdit: () => void;
  onUpdate: (d: Partial<Resource>) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.chips}>
          <StatusChip status={resource.resourceType} />
          <span className={styles.ctx}>{resource.contextType}</span>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {resource.status === 'saved' && (
            <button className={styles.studyBtn} onClick={() => onUpdate({ status: 'studying' })}>Study →</button>
          )}
          {resource.status === 'studying' && (
            <button className={styles.applyBtn} onClick={() => onUpdate({ status: 'applied' })}>✓ Applied</button>
          )}
          {resource.status !== 'archived' && (
            <button className={styles.archiveBtn} onClick={() => onUpdate({ status: 'archived' })}>Archive</button>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>{resource.title}</h3>
      {resource.url && (
        <a className={styles.url} href={resource.url} target="_blank" rel="noopener noreferrer">
          {resource.url}
        </a>
      )}
      {resource.notes && <p className={styles.cardNotes}>{resource.notes}</p>}
      {resource.nextMove ? (
        <div className={styles.next}>→ {resource.nextMove}</div>
      ) : (
        resource.status === 'studying' && (
          <div className={styles.noNext}>No next move — how will you apply this?</div>
        )
      )}
    </div>
  );
}

function ResourceModal({ resource, onClose, onSave }: {
  resource?: Resource;
  onClose: () => void;
  onSave: (data: Partial<Resource>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: resource?.title || '',
    url: resource?.url || '',
    notes: resource?.notes || '',
    resourceType: (resource?.resourceType || 'article') as ResourceType,
    status: resource?.status || 'saved',
    contextType: (resource?.contextType || 'general') as ContextType,
    nextMove: resource?.nextMove || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({ ...form, url: form.url || undefined } as Partial<Resource>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={resource ? 'Edit Resource' : 'Add Resource'}>
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Resource title" />
        </FormField>
        <FormField label="URL">
          <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" type="url" />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="What makes this valuable?" />
        </FormField>
        <FormRow>
          <FormField label="Type">
            <Select value={form.resourceType} onChange={(e) => set('resourceType', e.target.value)}>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="course">Course</option>
              <option value="tool">Tool</option>
              <option value="book">Book</option>
              <option value="prompt">Prompt</option>
              <option value="doc">Doc</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="saved">Saved</option>
              <option value="studying">Studying</option>
              <option value="applied">Applied</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Context">
          <Select value={form.contextType} onChange={(e) => set('contextType', e.target.value)}>
            <option value="general">General</option>
            <option value="personal">Personal</option>
            <option value="business">Business</option>
            <option value="learning">Learning</option>
            <option value="megaapp">MegaApp</option>
          </Select>
        </FormField>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="How will you apply this?" />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.title.trim() || saving}>
            {saving ? 'Saving…' : 'Save Resource'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
