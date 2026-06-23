import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type {
  Goal, GoalHorizon,
  Venture, VentureStatus,
  Task, Idea, Resource, Decision, Experiment, Relationship,
} from '../../types';
import styles from './GoalWorkspace.module.css';

function safeMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const t = ts as { toMillis?: () => number };
  return t.toMillis?.() ?? 0;
}

function safeDate(ts: unknown): string {
  const ms = safeMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function safeDateLong(ts: unknown): string {
  const ms = safeMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InlineEdit({
  value, placeholder, onSave, warn,
}: {
  value: string; placeholder: string; onSave: (v: string) => void; warn?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() { onSave(draft.trim()); setEditing(false); }

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
      {' '}<span className={styles.inlinePencil}>✎</span>
    </button>
  );
}

function WorkspaceSection({ title, count, children }: {
  title: string; count: number; children: ReactNode;
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

function TaskRow({ task, onToggleDone }: { task: Task; onToggleDone: () => void }) {
  const isDone = task.status === 'done';
  return (
    <div className={`${styles.itemRow} ${isDone ? styles.itemDone : ''}`}>
      <button className={styles.taskToggle} onClick={onToggleDone} title={isDone ? 'Mark todo' : 'Mark done'}>
        {isDone ? '●' : '○'}
      </button>
      <span className={styles.itemTitle}>{task.title}</span>
      <span className={`${styles.itemSub} ${styles[`status_${task.status}`]}`}>{task.status}</span>
      <span className={`${styles.itemSub} ${styles[`priority_${task.priority}`]}`}>{task.priority}</span>
    </div>
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

function QuickAddRow({ placeholder, onAdd }: {
  placeholder: string;
  onAdd: (title: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const t = value.trim();
    if (!t || saving) return;
    setSaving(true);
    try { await onAdd(t); setValue(''); } catch { /* retain value for retry */ } finally { setSaving(false); }
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
      <button className={styles.quickBtn} onClick={handleAdd} disabled={!value.trim() || saving}>
        {saving ? '…' : 'Add'}
      </button>
    </div>
  );
}

function ActivityRow({ type, title, sub, ts }: { type: string; title: string; sub: string; ts: unknown }) {
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

function GoalEditModal({ goal, ventures, onClose, onSave }: {
  goal: Goal;
  ventures: Venture[];
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: goal.title,
    description: goal.description,
    horizon: goal.horizon,
    status: goal.status,
    relatedVentureId: goal.relatedVentureId || '',
    nextMove: goal.nextMove || '',
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
    <Modal open onClose={onClose} title="Edit Goal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="Goal" required>
          <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Horizon">
            <Select value={form.horizon} onChange={(e) => set('horizon', e.target.value)}>
              {(['today','week','month','quarter','year','life'] as GoalHorizon[]).map((h) => (
                <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
              ))}
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
            {ventures.filter((v) => v.status !== 'archived').map((v) => (
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
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}

// ── Main workspace ──────────────────────────────────────────────────────────

export function GoalWorkspace() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();

  const { items: allGoals, update: updateGoal } = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: allVentures, add: addVenture } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: allTasks, add: addTask, update: updateTask } = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: allIdeas, add: addIdea } = useCollection<Idea>(COLLECTIONS.IDEAS);
  const { items: allResources, add: addResource } = useCollection<Resource>(COLLECTIONS.RESOURCES);
  const { items: allDecisions, add: addDecision } = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: allExperiments, add: addExperiment } = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);
  const { items: allRelationships, add: addRelationship } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);

  const [showEditModal, setShowEditModal] = useState(false);

  if (!goalId) return null;

  const goal = allGoals.find((g) => g.id === goalId);

  if (allGoals.length === 0) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/goals')}>← Goals</button>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className={styles.notFound}>
        <button className={styles.backBtn} onClick={() => navigate('/goals')}>← Goals</button>
        <p>Goal not found.</p>
      </div>
    );
  }

  // Filter related items — all use relatedGoalId
  const ventures     = allVentures.filter((v) => v.relatedGoalId === goalId);
  const tasks        = allTasks.filter((t) => t.relatedGoalId === goalId);
  const ideas        = allIdeas.filter((i) => i.relatedGoalId === goalId);
  const resources    = allResources.filter((r) => r.relatedGoalId === goalId);
  const decisions    = allDecisions.filter((d) => d.relatedGoalId === goalId);
  const experiments  = allExperiments.filter((e) => e.relatedGoalId === goalId);
  const relations    = allRelationships.filter((r) => r.relatedGoalId === goalId);

  const activeVentures     = ventures.filter((v) => v.status !== 'archived');
  const activeTasks        = tasks.filter((t) => t.status !== 'archived');
  const activeIdeas        = ideas.filter((i) => !['archived', 'parked'].includes(i.status));
  const activeResources    = resources.filter((r) => r.status !== 'archived');
  const activeDecisions    = decisions.filter((d) => d.status !== 'archived');
  const activeExperiments  = experiments.filter((e) => !['completed', 'abandoned'].includes(e.status));

  const totalLinked = activeVentures.length + activeTasks.length + activeIdeas.length +
    activeResources.length + activeDecisions.length + activeExperiments.length + relations.length;

  // Activity: all linked objects sorted by createdAt desc, top 12
  type ActivityEntry = { id: string; type: string; title: string; sub: string; ts: unknown };
  const activity: ActivityEntry[] = [
    ...ventures.map((v) => ({ id: v.id, type: 'venture', title: v.name, sub: v.status, ts: v.createdAt })),
    ...tasks.map((t) => ({ id: t.id, type: 'task', title: t.title, sub: t.status, ts: t.createdAt })),
    ...ideas.map((i) => ({ id: i.id, type: 'idea', title: i.title, sub: i.status, ts: i.createdAt })),
    ...resources.map((r) => ({ id: r.id, type: 'resource', title: r.title, sub: r.resourceType, ts: r.createdAt })),
    ...decisions.map((d) => ({ id: d.id, type: 'decision', title: d.title, sub: d.status, ts: d.createdAt })),
    ...experiments.map((e) => ({ id: e.id, type: 'experiment', title: e.title, sub: e.status, ts: e.createdAt })),
    ...relations.map((r) => ({ id: r.id, type: 'relationship', title: r.name, sub: r.role || '—', ts: r.createdAt })),
  ]
    .sort((a, b) => safeMillis(b.ts) - safeMillis(a.ts))
    .slice(0, 12);

  // Linked venture (goal.relatedVentureId — the legacy "goal belongs to venture" link)
  const parentVenture = allVentures.find((v) => v.id === goal.relatedVentureId);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/goals')}>← Goals</button>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTop}>
            <h1 className={styles.goalTitle}>{goal.title}</h1>
            <span className={`${styles.horizonBadge} ${styles[`horizon_${goal.horizon}`]}`}>
              {goal.horizon}
            </span>
            <span className={`${styles.statusBadge} ${styles[`status_${goal.status}`]}`}>
              {goal.status}
            </span>
          </div>
          {goal.description && <p className={styles.goalDesc}>{goal.description}</p>}
          <div className={styles.headerMeta}>
            <span>Created {safeDateLong(goal.createdAt)}</span>
            <span className={styles.metaSep}>·</span>
            <span>Updated {safeDateLong(goal.updatedAt)}</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaCount}>{totalLinked} linked item{totalLinked !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.editBtn} onClick={() => setShowEditModal(true)}>Edit</button>
        </div>
      </div>

      {/* Next Move + parent venture inline */}
      <div className={styles.focusBar}>
        <div className={styles.focusRow}>
          <span className={styles.focusLabel}>Next Move</span>
          <InlineEdit
            value={goal.nextMove || ''}
            placeholder="Set next move — empty = stalled in Mission Control"
            onSave={(v) => updateGoal(goal.id, { nextMove: v })}
            warn
          />
        </div>
        {parentVenture && (
          <div className={styles.focusRow}>
            <span className={styles.focusLabel}>Venture</span>
            <button
              className={styles.ventureLink}
              onClick={() => navigate(`/ventures/${parentVenture.id}`)}
            >
              {parentVenture.name} →
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className={styles.sections}>

        <WorkspaceSection title="Ventures" count={activeVentures.length}>
          {activeVentures.length === 0 && <p className={styles.emptySection}>No ventures linked yet.</p>}
          {activeVentures.map((v) => (
            <ItemRow key={v.id} title={v.name} sub={v.status} extra={v.nextMove} />
          ))}
          <QuickAddRow
            placeholder="Add venture name…"
            onAdd={(title) =>
              addVenture({
                name: title,
                description: '',
                status: 'seed' as VentureStatus,
                category: 'other',
                relatedGoalId: goalId,
              } as Omit<Venture, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Tasks" count={activeTasks.length}>
          {activeTasks.length === 0 && <p className={styles.emptySection}>No tasks yet.</p>}
          {activeTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggleDone={() => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })}
            />
          ))}
          <QuickAddRow
            placeholder="Add task…"
            onAdd={(title) =>
              addTask({
                title,
                status: 'todo',
                priority: 'medium',
                relatedGoalId: goalId,
              } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Ideas" count={activeIdeas.length}>
          {activeIdeas.length === 0 && <p className={styles.emptySection}>No ideas yet.</p>}
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
                relatedGoalId: goalId,
              } as Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Resources" count={activeResources.length}>
          {activeResources.length === 0 && <p className={styles.emptySection}>No resources yet.</p>}
          {activeResources.map((r) => (
            <ItemRow key={r.id} title={r.title} sub={r.resourceType} extra={r.url} />
          ))}
          <QuickAddRow
            placeholder="Add resource…"
            onAdd={(title) =>
              addResource({
                title,
                resourceType: 'other',
                status: 'saved',
                contextType: 'business',
                relatedGoalId: goalId,
              } as Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Decisions" count={activeDecisions.length}>
          {activeDecisions.length === 0 && <p className={styles.emptySection}>No decisions logged yet.</p>}
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
                relatedGoalId: goalId,
              } as Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Experiments" count={activeExperiments.length}>
          {activeExperiments.length === 0 && <p className={styles.emptySection}>No experiments yet.</p>}
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
                relatedGoalId: goalId,
              } as Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Relationships" count={relations.length}>
          {relations.length === 0 && <p className={styles.emptySection}>No contacts linked yet.</p>}
          {relations.map((r) => (
            <ItemRow key={r.id} title={r.name} sub={r.role || '—'} extra={r.nextAction} />
          ))}
          <QuickAddRow
            placeholder="Add contact name…"
            onAdd={(title) =>
              addRelationship({
                name: title,
                relatedGoalId: goalId,
              } as Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>)
            }
          />
        </WorkspaceSection>

        <WorkspaceSection title="Activity" count={activity.length}>
          {activity.length === 0
            ? <p className={styles.emptySection}>No activity yet. Add items above to get started.</p>
            : activity.map((a) => (
                <ActivityRow key={`${a.type}-${a.id}`} type={a.type} title={a.title} sub={a.sub} ts={a.ts} />
              ))
          }
        </WorkspaceSection>

      </div>

      {showEditModal && (
        <GoalEditModal
          goal={goal}
          ventures={allVentures}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => {
            await updateGoal(goal.id, data);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
