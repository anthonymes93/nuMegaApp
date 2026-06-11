import { useState } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { PriorityChip } from '../../components/ui/Chip';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type { Task, TaskStatus, Priority, Venture } from '../../types';
import styles from './Tasks.module.css';

export function Tasks() {
  const { items, add, update } = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Priority | 'all'>('all');

  const active = items.filter((t) => t.status !== 'archived');
  const filtered = filter === 'all' ? active : active.filter((t) => t.priority === filter);

  const todo = filtered.filter((t) => t.status === 'todo');
  const doing = filtered.filter((t) => t.status === 'doing');
  const done = filtered.filter((t) => t.status === 'done');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tasks</h1>
          <p className={styles.subtitle}>Everything that needs to get done.</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ New Task</Btn>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              className={`${styles.filterBtn} ${filter === p ? styles.filterActive : ''}`}
              onClick={() => setFilter(p)}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.columns}>
        <TaskColumn
          title="To Do"
          tasks={todo}
          onEdit={(t) => setEditing(t)}
          onUpdate={(id, d) => update(id, d)}
          status="todo"
        />
        <TaskColumn
          title="Doing"
          tasks={doing}
          onEdit={(t) => setEditing(t)}
          onUpdate={(id, d) => update(id, d)}
          status="doing"
        />
        <TaskColumn
          title="Done"
          tasks={done}
          onEdit={(t) => setEditing(t)}
          onUpdate={(id, d) => update(id, d)}
          status="done"
        />
      </div>

      {(showForm || editing) && (
        <TaskModal
          task={editing || undefined}
          ventures={ventures}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) await update(editing.id, data);
            else await add(data as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TaskColumn({ title, tasks, onEdit, onUpdate, status }: {
  title: string;
  tasks: Task[];
  onEdit: (t: Task) => void;
  onUpdate: (id: string, d: Partial<Task>) => void;
  status: TaskStatus;
}) {
  return (
    <div className={styles.column}>
      <div className={styles.colHeader}>
        <span className={styles.colTitle}>{title}</span>
        <span className={styles.colCount}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.emptyCol}>
          {status === 'todo' ? 'No tasks queued.' : status === 'doing' ? 'Nothing in progress.' : 'Nothing done yet.'}
        </p>
      ) : (
        <div className={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={() => onEdit(task)} onUpdate={(d) => onUpdate(task.id, d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onUpdate }: { task: Task; onEdit: () => void; onUpdate: (d: Partial<Task>) => void }) {
  return (
    <div className={styles.taskCard}>
      <div className={styles.taskTop}>
        <PriorityChip priority={task.priority} />
        <div className={styles.taskActions}>
          <button className={styles.taskBtn} onClick={onEdit}>Edit</button>
          {task.status === 'todo' && (
            <button className={styles.taskBtnAccent} onClick={() => onUpdate({ status: 'doing' })}>Start</button>
          )}
          {task.status === 'doing' && (
            <button className={styles.taskBtnSuccess} onClick={() => onUpdate({ status: 'done' })}>✓ Done</button>
          )}
          {task.status === 'done' && (
            <button className={styles.taskBtnGhost} onClick={() => onUpdate({ status: 'archived' })}>Archive</button>
          )}
        </div>
      </div>
      <p className={styles.taskTitle}>{task.title}</p>
      {task.notes && <p className={styles.taskNotes}>{task.notes}</p>}
      {task.dueAt && (
        <p className={styles.taskDue}>Due: {task.dueAt.toDate().toLocaleDateString()}</p>
      )}
    </div>
  );
}

function TaskModal({ task, ventures, onClose, onSave }: {
  task?: Task;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: task?.title || '',
    notes: task?.notes || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    relatedType: task?.relatedType || '',
    relatedId: task?.relatedId || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      relatedType: form.relatedType as Task['relatedType'] || undefined,
      relatedId: form.relatedId || undefined,
    } as Partial<Task>);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={task ? 'Edit Task' : 'New Task'}>
      <div className={styles.form}>
        <FormField label="Task" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs to be done?" />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any details or context…" />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="todo">To Do</option>
              <option value="doing">Doing</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
          <FormField label="Priority">
            <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Related Type">
            <Select value={form.relatedType} onChange={(e) => set('relatedType', e.target.value)}>
              <option value="">None</option>
              <option value="venture">Venture</option>
              <option value="goal">Goal</option>
              <option value="idea">Idea</option>
              <option value="experiment">Experiment</option>
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
          <Btn onClick={handleSave} disabled={!form.title.trim() || saving}>
            {saving ? 'Saving…' : 'Save Task'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
