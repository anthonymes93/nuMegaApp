import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type {
  Venture, VentureStatus,
  Task, Idea, Goal, Resource, Decision, Experiment, Relationship,
} from '../../types';
import styles from './VentureWorkspace.module.css';

function safeMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const t = ts as { toMillis?: () => number };
  return t.toMillis?.() ?? 0;
}

function safeDate(ts: unknown): string {
  const ms = safeMillis(ts);
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function safeDateLong(ts: unknown): string {
  const ms = safeMillis(ts);
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InlineEdit({
  value,
  placeholder,
  onSave,
  warn,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  warn?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className={styles.inlineInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <button
      className={`${styles.inlineView} ${warn && !value ? styles.inlineWarn : ''}`}
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className={styles.inlinePlaceholder}>{placeholder}</span>}
      {' '}
      <span className={styles.inlinePencil}>✎</span>
    </button>
  );
}

function WorkspaceSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {count > 0 && <span className={styles.sectionCount}>{count}</span>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function TaskRow({
  task,
  onToggleDone,
  onDelete,
  onView,
}: {
  task: Task;
  onToggleDone: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isDone = task.status === 'done';

  return (
    <div className={`${styles.taskCard} ${isDone ? styles.taskCardDone : ''}`}>
      <div className={styles.taskTop}>
        <button
          className={styles.taskToggle}
          onClick={onToggleDone}
          title={isDone ? 'Undo done' : 'Mark done'}
        >
          {isDone ? '✓' : '○'}
        </button>
        <button className={styles.taskTitleBtn} onClick={onView}>
          {task.title}
        </button>
      </div>

      {task.notes && (
        <p className={styles.taskNotes}>{task.notes}</p>
      )}

      <div className={styles.taskBottom}>
        <div className={styles.taskChips}>
          <span className={`${styles.taskChip} ${styles[`priority_${task.priority}`]}`}>
            {task.priority}
          </span>
          <span className={`${styles.taskChip} ${styles[`status_${task.status}`]}`}>
            {task.status}
          </span>
        </div>
        <div className={styles.taskActions}>
          {confirmDel ? (
            <>
              <button
                className={styles.taskDelConfirm}
                onClick={() => { onDelete(); setConfirmDel(false); }}
              >
                Confirm delete
              </button>
              <button className={styles.taskDelCancel} onClick={() => setConfirmDel(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className={styles.taskActionBtn} onClick={onToggleDone}>
                {isDone ? 'Undo' : 'Done'}
              </button>
              <button
                className={styles.taskDelBtn}
                onClick={() => setConfirmDel(true)}
                title="Delete task"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  ventureName,
  onClose,
  onToggleDone,
}: {
  task: Task;
  ventureName: string;
  onClose: () => void;
  onToggleDone: () => void;
}) {
  const isDone = task.status === 'done';

  return (
    <Modal open onClose={onClose} title="Task" width={480}>
      <div className={styles.detailBody}>
        <div className={styles.detailChips}>
          <span className={`${styles.detailChip} ${styles[`priority_${task.priority}`]}`}>
            {task.priority}
          </span>
          <span className={`${styles.detailChip} ${styles[`status_${task.status}`]}`}>
            {task.status}
          </span>
        </div>

        <h3 className={styles.detailTitle}>{task.title}</h3>

        {task.notes && (
          <div className={styles.detailField}>
            <span className={styles.detailLabel}>Notes</span>
            <p className={styles.detailValue}>{task.notes}</p>
          </div>
        )}

        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Venture</span>
          <p className={styles.detailValue}>{ventureName}</p>
        </div>

        <div className={styles.detailDates}>
          {task.createdAt && <span>Created {safeDateLong(task.createdAt)}</span>}
          {task.updatedAt && <span>Updated {safeDateLong(task.updatedAt)}</span>}
        </div>

        <div className={styles.detailActions}>
          <button className={styles.detailDoneBtn} onClick={onToggleDone}>
            {isDone ? 'Undo Done' : 'Mark Done'}
          </button>
          <button className={styles.detailCloseBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ItemRow({ title, sub, extra }: { title: string; sub: string; extra?: string }) {
  return (
    <div className={styles.itemRow}>
      <span className={styles.itemTitle}>{title}</span>
      {sub && <span className={styles.itemSub}>{sub}</span>}
      {extra && <span className={styles.itemExtra}>{extra}</span>}
    </div>
  );
}

function QuickAddRow({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (title: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const t = value.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await onAdd(t);
      setValue('');
    } catch {
      // silent — item will remain in input for retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.quickAdd}>
      <input
        className={styles.quickInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        disabled={saving}
      />
      <button
        className={styles.quickBtn}
        onClick={handleAdd}
        disabled={!value.trim() || saving}
      >
        {saving ? '…' : 'Add'}
      </button>
    </div>
  );
}

function ActivityRow({ type, title, sub, ts }: {
  type: string;
  title: string;
  sub: string;
  ts: unknown;
}) {
  return (
    <div className={styles.activityRow}>
      <span className={`${styles.activityType} ${styles[`at_${type}`]}`}>
        {type.replace('_', ' ')}
      </span>
      <span className={styles.activityTitle}>{title}</span>
      <span className={styles.activitySub}>{sub}</span>
      <span className={styles.activityDate}>{safeDate(ts)}</span>
    </div>
  );
}

// ── Edit modal ──────────────────────────────────────────────────────────────

function VentureEditModal({
  venture,
  onClose,
  onSave,
}: {
  venture: Venture;
  onClose: () => void;
  onSave: (data: Partial<Venture>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: venture.name,
    description: venture.description,
    status: venture.status,
    category: venture.category,
    currentFocus: venture.currentFocus || '',
    nextMove: venture.nextMove || '',
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
    <Modal open onClose={onClose} title="Edit Venture">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="Name" required>
          <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {(['seed','active','validating','launched','paused','archived'] as VentureStatus[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Category">
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {(['software','service','content','contractor','personal','other']).map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </Select>
          </FormField>
        </FormRow>
        <FormField label="Current Focus">
          <Input value={form.currentFocus} onChange={(e) => set('currentFocus', e.target.value)} placeholder="What are you focused on?" />
        </FormField>
        <FormField label="Next Move">
          <Input value={form.nextMove} onChange={(e) => set('nextMove', e.target.value)} placeholder="Immediate next step" />
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

// ── Main workspace ──────────────────────────────────────────────────────────

export function VentureWorkspace() {
  const { ventureId } = useParams<{ ventureId: string }>();
  const navigate = useNavigate();

  const { items: allVentures, update: updateVenture } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: allTasks, add: addTask, update: updateTask, remove: removeTask } = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: allIdeas, add: addIdea } = useCollection<Idea>(COLLECTIONS.IDEAS);
  const { items: allGoals, add: addGoal } = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: allResources, add: addResource } = useCollection<Resource>(COLLECTIONS.RESOURCES);
  const { items: allDecisions, add: addDecision } = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: allExperiments, add: addExperiment } = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);
  const { items: allRelationships, add: addRelationship } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Close task detail modal if the task was deleted while open
  useEffect(() => {
    if (selectedTaskId && !allTasks.find((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [allTasks, selectedTaskId]);

  if (!ventureId) return null;

  const venture = allVentures.find((v) => v.id === ventureId);

  if (allVentures.length === 0) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/ventures')}>← Ventures</button>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!venture) {
    return (
      <div className={styles.notFound}>
        <button className={styles.backBtn} onClick={() => navigate('/ventures')}>← Ventures</button>
        <p>Venture not found.</p>
      </div>
    );
  }

  // Filter related items client-side
  const tasks       = allTasks.filter((t) => t.relatedType === 'venture' && t.relatedId === ventureId);
  const ideas       = allIdeas.filter((i) => i.relatedVentureId === ventureId);
  const goals       = allGoals.filter((g) => g.relatedVentureId === ventureId);
  const resources   = allResources.filter((r) => r.relatedVentureId === ventureId);
  const decisions   = allDecisions.filter((d) => d.relatedType === 'venture' && d.relatedId === ventureId);
  const experiments = allExperiments.filter((e) => e.relatedVentureId === ventureId);
  const relations   = allRelationships.filter((r) => r.relatedVentureId === ventureId);

  const activeTasks       = tasks.filter((t) => t.status !== 'archived');
  const activeIdeas       = ideas.filter((i) => !['archived', 'parked'].includes(i.status));
  const activeGoals       = goals.filter((g) => g.status === 'active');
  const activeResources   = resources.filter((r) => r.status !== 'archived');
  const activeDecisions   = decisions.filter((d) => d.status !== 'archived');
  const activeExperiments = experiments.filter((e) => !['completed', 'abandoned'].includes(e.status));

  const totalLinked = activeTasks.length + activeIdeas.length + activeGoals.length +
    activeResources.length + activeDecisions.length + activeExperiments.length + relations.length;

  const linkedGoal = allGoals.find((g) => g.id === venture.relatedGoalId);

  // Derive live task from the subscription so the modal stays current after updates
  const selectedTask = selectedTaskId ? allTasks.find((t) => t.id === selectedTaskId) ?? null : null;

  type ActivityEntry = { id: string; type: string; title: string; sub: string; ts: unknown };
  const activity: ActivityEntry[] = [
    ...tasks.map((t) => ({ id: t.id, type: 'task', title: t.title, sub: t.status, ts: t.createdAt })),
    ...ideas.map((i) => ({ id: i.id, type: 'idea', title: i.title, sub: i.status, ts: i.createdAt })),
    ...goals.map((g) => ({ id: g.id, type: 'goal', title: g.title, sub: g.horizon, ts: g.createdAt })),
    ...resources.map((r) => ({ id: r.id, type: 'resource', title: r.title, sub: r.resourceType, ts: r.createdAt })),
    ...decisions.map((d) => ({ id: d.id, type: 'decision', title: d.title, sub: d.status, ts: d.createdAt })),
    ...experiments.map((e) => ({ id: e.id, type: 'experiment', title: e.title, sub: e.status, ts: e.createdAt })),
    ...relations.map((r) => ({ id: r.id, type: 'relationship', title: r.name, sub: r.role || '—', ts: r.createdAt })),
  ]
    .sort((a, b) => safeMillis(b.ts) - safeMillis(a.ts))
    .slice(0, 12);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/ventures')}>← Ventures</button>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTop}>
            <h1 className={styles.ventureName}>{venture.name}</h1>
            <span className={`${styles.statusBadge} ${styles[`status_${venture.status}`]}`}>
              {venture.status}
            </span>
            <span className={styles.categoryBadge}>{venture.category}</span>
          </div>
          {venture.description && (
            <p className={styles.ventureDesc}>{venture.description}</p>
          )}
          <div className={styles.headerMeta}>
            <span>Created {safeDateLong(venture.createdAt)}</span>
            <span className={styles.metaSep}>·</span>
            <span>Updated {safeDateLong(venture.updatedAt)}</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaCount}>{totalLinked} linked item{totalLinked !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.editBtn} onClick={() => setShowEditModal(true)}>Edit</button>
        </div>
      </div>

      {/* Focus + Next Move inline editing */}
      <div className={styles.focusBar}>
        <div className={styles.focusRow}>
          <span className={styles.focusLabel}>Focus</span>
          <InlineEdit
            value={venture.currentFocus || ''}
            placeholder="Set current focus…"
            onSave={(v) => updateVenture(venture.id, { currentFocus: v })}
          />
        </div>
        <div className={styles.focusRow}>
          <span className={styles.focusLabel}>Next Move</span>
          <InlineEdit
            value={venture.nextMove || ''}
            placeholder="Set next move — empty = stuck in Mission Control"
            onSave={(v) => updateVenture(venture.id, { nextMove: v })}
            warn
          />
        </div>
        {linkedGoal && (
          <div className={styles.focusRow}>
            <span className={styles.focusLabel}>Goal</span>
            <button
              className={styles.goalLink}
              onClick={() => navigate(`/goals/${linkedGoal.id}`)}
            >
              {linkedGoal.title} ({linkedGoal.horizon}) →
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className={styles.sections}>

        <WorkspaceSection title="Tasks" count={activeTasks.length}>
          {activeTasks.length === 0 && (
            <p className={styles.emptySection}>No tasks yet.</p>
          )}
          {activeTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggleDone={() => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
              onDelete={() => removeTask(t.id)}
              onView={() => setSelectedTaskId(t.id)}
            />
          ))}
          <QuickAddRow
            placeholder="Add task…"
            onAdd={(title) =>
              addTask({
                title,
                status: 'todo',
                priority: 'medium',
                relatedType: 'venture',
                relatedId: ventureId,
              } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Ideas" count={activeIdeas.length}>
          {activeIdeas.length === 0 && (
            <p className={styles.emptySection}>No ideas yet.</p>
          )}
          {activeIdeas.map((i) => (
            <ItemRow key={i.id} title={i.title} sub={i.status} />
          ))}
          <QuickAddRow
            placeholder="Add idea…"
            onAdd={(title) =>
              addIdea({
                title,
                description: '',
                contextType: 'business',
                status: 'raw',
                potential: 'medium',
                relatedVentureId: ventureId,
              } as Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Goals" count={activeGoals.length}>
          {activeGoals.length === 0 && (
            <p className={styles.emptySection}>No goals yet.</p>
          )}
          {activeGoals.map((g) => (
            <ItemRow key={g.id} title={g.title} sub={g.horizon} />
          ))}
          <QuickAddRow
            placeholder="Add goal…"
            onAdd={(title) =>
              addGoal({
                title,
                description: '',
                horizon: 'quarter',
                status: 'active',
                relatedVentureId: ventureId,
              } as Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Resources" count={activeResources.length}>
          {activeResources.length === 0 && (
            <p className={styles.emptySection}>No resources yet.</p>
          )}
          {activeResources.map((r) => (
            <ItemRow key={r.id} title={r.title} sub={r.resourceType} extra={r.url} />
          ))}
          <QuickAddRow
            placeholder="Add resource (title or URL)…"
            onAdd={(title) =>
              addResource({
                title,
                resourceType: 'other',
                status: 'saved',
                contextType: 'business',
                relatedVentureId: ventureId,
              } as Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Decisions" count={activeDecisions.length}>
          {activeDecisions.length === 0 && (
            <p className={styles.emptySection}>No decisions logged yet.</p>
          )}
          {activeDecisions.map((d) => (
            <ItemRow key={d.id} title={d.title} sub={d.status} extra={d.reasoning} />
          ))}
          <QuickAddRow
            placeholder="Log a decision…"
            onAdd={(title) =>
              addDecision({
                title,
                decision: title,
                contextType: 'business',
                status: 'active',
                relatedType: 'venture',
                relatedId: ventureId,
              } as Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Experiments" count={activeExperiments.length}>
          {activeExperiments.length === 0 && (
            <p className={styles.emptySection}>No experiments yet.</p>
          )}
          {activeExperiments.map((e) => (
            <ItemRow key={e.id} title={e.title} sub={e.status} />
          ))}
          <QuickAddRow
            placeholder="Add experiment or hypothesis…"
            onAdd={(title) =>
              addExperiment({
                title,
                hypothesis: title,
                status: 'idea',
                relatedVentureId: ventureId,
              } as Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Relationships" count={relations.length}>
          {relations.length === 0 && (
            <p className={styles.emptySection}>No contacts linked yet.</p>
          )}
          {relations.map((r) => (
            <ItemRow key={r.id} title={r.name} sub={r.role || '—'} extra={r.nextAction} />
          ))}
          <QuickAddRow
            placeholder="Add contact name…"
            onAdd={(title) =>
              addRelationship({
                name: title,
                relatedVentureId: ventureId,
              } as Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Activity" count={activity.length}>
          {activity.length === 0 ? (
            <p className={styles.emptySection}>No activity yet. Add items above to get started.</p>
          ) : (
            activity.map((a) => (
              <ActivityRow key={`${a.type}-${a.id}`} type={a.type} title={a.title} sub={a.sub} ts={a.ts} />
            ))
          )}
        </WorkspaceSection>

      </div>

      {showEditModal && (
        <VentureEditModal
          venture={venture}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => {
            await updateVenture(venture.id, data);
            setShowEditModal(false);
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          ventureName={venture.name}
          onClose={() => setSelectedTaskId(null)}
          onToggleDone={() =>
            updateTask(selectedTask.id, {
              status: selectedTask.status === 'done' ? 'todo' : 'done',
            })
          }
        />
      )}
    </div>
  );
}
