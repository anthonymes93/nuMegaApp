import { useState, useEffect, useCallback, useRef } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { useCollection } from '../../hooks/useCollection';
import { addDocument, COLLECTIONS } from '../../lib/firestore';
import { classify } from '../../lib/classifier';
import { Modal } from '../../components/ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../../components/ui/FormField';
import type {
  InboxItem, InboxType, Venture, Idea, Goal, Resource, Decision, Experiment, Relationship,
  Priority, GoalHorizon, ResourceType,
} from '../../types';
import styles from './Inbox.module.css';

const TABS = ['queue', 'reviewed', 'converted', 'archived'] as const;
type Tab = typeof TABS[number];

const TAB_STATUS: Record<Tab, InboxItem['status']> = {
  queue: 'captured',
  reviewed: 'reviewed',
  converted: 'converted',
  archived: 'archived',
};

// Sentinel to cast serverTimestamp() into Timestamp-typed fields
const ts = () => serverTimestamp() as unknown as Timestamp;

export function Inbox() {
  const { items, update, remove } = useCollection<InboxItem>(COLLECTIONS.INBOX);
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [converting, setConverting] = useState<InboxItem | null>(null);
  const [editing, setEditing] = useState<InboxItem | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queue = items.filter((i) => i.status === 'captured');
  const listItems = items.filter((i) => i.status === TAB_STATUS[activeTab]);

  const isModalOpen = converting !== null || editing !== null;

  function showFlash(msg: string) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(msg);
    flashTimerRef.current = setTimeout(() => setFlash(null), 2500);
  }

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  // Clamp selectedIdx when queue shrinks (approve/archive/delete removes items)
  useEffect(() => {
    if (queue.length > 0) {
      setSelectedIdx((i) => Math.min(i, queue.length - 1));
    }
  }, [queue.length]);

  // Reset selection on tab change
  useEffect(() => {
    setSelectedIdx(0);
  }, [activeTab]);

  const handleApprove = useCallback(
    (item: InboxItem) => {
      const c = classify(item.rawInput || item.title);
      update(item.id, {
        status: 'reviewed',
        type: item.possibleType ?? c.possibleType,
        processedAt: ts(),
      });
      showFlash('Approved — moved to Reviewed.');
    },
    [update]
  );

  const handleArchive = useCallback(
    (item: InboxItem) => {
      update(item.id, { status: 'archived', processedAt: ts() });
      showFlash('Archived.');
    },
    [update]
  );

  const handleDelete = useCallback(
    (item: InboxItem) => {
      if (!window.confirm(`Delete "${item.title}"?\n\nThis cannot be undone.`)) return;
      remove(item.id);
      showFlash('Deleted.');
    },
    [remove]
  );

  // Keyboard shortcuts — only active on queue tab, no modal open, no input focused
  useEffect(() => {
    if (activeTab !== 'queue' || isModalOpen) return;

    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT'
      ) return;

      const current = queue[selectedIdx];

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          if (queue.length === 0) break;
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, queue.length - 1));
          break;
        case 'ArrowUp':
        case 'k':
          if (queue.length === 0) break;
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          break;
        case 'a':
          if (current) { e.preventDefault(); handleApprove(current); }
          break;
        case 'c':
          if (current) { e.preventDefault(); setConverting(current); }
          break;
        case 'x':
          if (current) { e.preventDefault(); handleArchive(current); }
          break;
        case 'd':
          if (current) { e.preventDefault(); handleDelete(current); }
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab, isModalOpen, queue, selectedIdx, handleApprove, handleArchive, handleDelete]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inbox</h1>
        <p className={styles.subtitle}>Every capture flows through here. Process to move forward.</p>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => {
          const count = items.filter((i) => i.status === TAB_STATUS[tab]).length;
          return (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'queue' ? 'Queue' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {count > 0 && <span className={styles.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {activeTab === 'queue' ? (
        <ProcessingQueue
          items={queue}
          selectedIdx={selectedIdx}
          flash={flash}
          onSelect={setSelectedIdx}
          onApprove={handleApprove}
          onConvert={setConverting}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onTypeChange={(item, type) => update(item.id, { possibleType: type })}
        />
      ) : (
        <div className={styles.list}>
          {listItems.length === 0 ? (
            <p className={styles.emptyMsg}>No {activeTab} items.</p>
          ) : (
            listItems.map((item) => (
              <ReviewedCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onConvert={() => setConverting(item)}
                onStatusChange={(status) => update(item.id, { status })}
              />
            ))
          )}
        </div>
      )}

      {converting && (
        <ConvertModal
          item={converting}
          onClose={() => setConverting(null)}
          onConverted={(convertedTo) => {
            update(converting.id, {
              status: 'converted',
              convertedTo,
              processedAt: ts(),
            });
            setConverting(null);
          }}
        />
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => { update(editing.id, data); setEditing(null); }}
        />
      )}
    </div>
  );
}

/* ── Processing Queue ────────────────────────────────── */

function ProcessingQueue({
  items,
  selectedIdx,
  flash,
  onSelect,
  onApprove,
  onConvert,
  onArchive,
  onDelete,
  onTypeChange,
}: {
  items: InboxItem[];
  selectedIdx: number;
  flash: string | null;
  onSelect: (i: number) => void;
  onApprove: (item: InboxItem) => void;
  onConvert: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void;
  onDelete: (item: InboxItem) => void;
  onTypeChange: (item: InboxItem, type: InboxType) => void;
}) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  if (items.length === 0) {
    return (
      <div className={styles.queueEmpty}>
        <p className={styles.queueEmptyTitle}>Queue is clear.</p>
        <p className={styles.queueEmptyHint}>Use the capture bar (⌘K) to add items.</p>
      </div>
    );
  }

  return (
    <div className={styles.queue}>
      <div className={styles.queueList}>
        {items.map((item, idx) => {
          const isSelected = idx === selectedIdx;
          const displayType = item.possibleType || 'unclassified';
          const confidence = item.confidence || 'low';

          return (
            <div
              key={item.id}
              ref={isSelected ? selectedRef : undefined}
              className={`${styles.queueRow} ${isSelected ? styles.queueRowSelected : ''}`}
              onClick={() => onSelect(idx)}
            >
              <div className={styles.queueRowTop}>
                <div className={styles.queueRowLeft}>
                  <span className={styles.queueCaret}>{isSelected ? '▶' : ' '}</span>
                  <span className={styles.queueTitle}>{item.title}</span>
                </div>
                <div className={styles.queueRowRight}>
                  {isSelected ? (
                    <select
                      className={styles.typeSelect}
                      value={displayType}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onTypeChange(item, e.target.value as InboxType)}
                    >
                      <option value="unclassified">Unclassified</option>
                      <option value="task">Task</option>
                      <option value="idea">Idea</option>
                      <option value="goal">Goal</option>
                      <option value="resource">Resource</option>
                      <option value="decision">Decision</option>
                      <option value="experiment">Experiment</option>
                      <option value="venture_note">Venture Note</option>
                      <option value="relationship">Relationship</option>
                    </select>
                  ) : (
                    <TypeBadge type={displayType} />
                  )}
                  <ConfidenceDots confidence={confidence} />
                </div>
              </div>

              {isSelected && (
                <div className={styles.queueExpanded}>
                  {item.rawInput && item.rawInput !== item.title && (
                    <p className={styles.queueRaw}>{item.rawInput}</p>
                  )}
                  {item.body && <p className={styles.queueBody}>{item.body}</p>}
                  {item.tags && item.tags.length > 0 && (
                    <div className={styles.queueTags}>
                      {item.tags.map((t) => (
                        <span key={t} className={styles.queueTag}>{t}</span>
                      ))}
                    </div>
                  )}
                  <div className={styles.queueActions}>
                    <button
                      className={styles.queueBtn}
                      onClick={(e) => { e.stopPropagation(); onApprove(item); }}
                    >
                      <span className={styles.queueBtnKey}>[A]</span> Approve
                    </button>
                    <button
                      className={`${styles.queueBtn} ${styles.queueBtnAccent}`}
                      onClick={(e) => { e.stopPropagation(); onConvert(item); }}
                    >
                      <span className={styles.queueBtnKey}>[C]</span> Convert →
                    </button>
                    <button
                      className={styles.queueBtn}
                      onClick={(e) => { e.stopPropagation(); onArchive(item); }}
                    >
                      <span className={styles.queueBtnKey}>[X]</span> Archive
                    </button>
                    <button
                      className={`${styles.queueBtn} ${styles.queueBtnDanger}`}
                      onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                    >
                      <span className={styles.queueBtnKey}>[D]</span> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.queueHint}>
        {flash
          ? <span className={styles.queueFlash}>{flash}</span>
          : '↑↓ / J K navigate · A approve · C convert · X archive · D delete'}
      </div>
    </div>
  );
}

/* ── Type Badge & Confidence Dots ────────────────────── */

const TYPE_ABBR: Record<InboxType, string> = {
  unclassified: 'UNCL',
  task: 'TASK',
  idea: 'IDEA',
  goal: 'GOAL',
  resource: 'RES',
  decision: 'DEC',
  experiment: 'EXP',
  venture_note: 'VNT',
  relationship: 'REL',
};

function TypeBadge({ type }: { type: InboxType }) {
  return (
    <span className={`${styles.typeBadge} ${styles[`type_${type}`]}`}>
      {TYPE_ABBR[type] ?? type}
    </span>
  );
}

function ConfidenceDots({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const n = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
  return (
    <span className={styles.confDots}>
      {'▪'.repeat(n)}{'○'.repeat(3 - n)}
    </span>
  );
}

/* ── Reviewed / Converted / Archived card ───────────── */

function ReviewedCard({
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
        <div className={styles.cardLeft}>
          <TypeBadge type={item.type} />
          {item.confidence && <ConfidenceDots confidence={item.confidence} />}
          <span className={styles.cardCtx}>{item.contextType}</span>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={onEdit}>Edit</button>
          {/* Reviewed: can convert or archive */}
          {item.status === 'reviewed' && (
            <>
              <button className={styles.actionBtn} onClick={onConvert}>Convert →</button>
              <button className={styles.actionBtn} onClick={() => onStatusChange('archived')}>Archive</button>
            </>
          )}
          {/* Archived: restore to queue */}
          {item.status === 'archived' && (
            <button className={styles.actionBtn} onClick={() => onStatusChange('captured')}>Restore</button>
          )}
          {/* Converted: show badge only */}
          {item.convertedTo && (
            <span className={styles.convertedBadge}>{item.convertedTo.type.replace('_', ' ')}</span>
          )}
        </div>
      </div>
      <p className={styles.cardTitle}>{item.title}</p>
      {item.body && <p className={styles.cardBody}>{item.body}</p>}
      {item.nextMove && (
        <p className={styles.cardNext}><span className={styles.nextLabel}>→</span> {item.nextMove}</p>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className={styles.queueTags}>
          {item.tags.map((t) => <span key={t} className={styles.queueTag}>{t}</span>)}
        </div>
      )}
    </div>
  );
}

/* ── Edit Modal ──────────────────────────────────────── */

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
    urgency: item.urgency,
    nextMove: item.nextMove || '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title="Edit Item">
      <div className={styles.form}>
        <FormField label="Title" required>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} />
        </FormField>
        <FormRow>
          <FormField label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="unclassified">Unclassified</option>
              <option value="task">Task</option>
              <option value="idea">Idea</option>
              <option value="goal">Goal</option>
              <option value="resource">Resource</option>
              <option value="decision">Decision</option>
              <option value="experiment">Experiment</option>
              <option value="venture_note">Venture Note</option>
              <option value="relationship">Relationship</option>
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
        <FormField label="Next Move">
          <Input
            value={form.nextMove}
            onChange={(e) => set('nextMove', e.target.value)}
            placeholder="Immediate next step"
          />
        </FormField>
        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(form as Partial<InboxItem>)} disabled={!form.title.trim()}>Save</Btn>
        </FormActions>
      </div>
    </Modal>
  );
}

/* ── Convert Modal ───────────────────────────────────── */

type ConvertTarget =
  | 'task' | 'idea' | 'goal' | 'resource'
  | 'decision' | 'experiment' | 'venture_note' | 'relationship';

function ConvertModal({
  item,
  onClose,
  onConverted,
}: {
  item: InboxItem;
  onClose: () => void;
  onConverted: (ref: { type: string; id: string }) => void;
}) {
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);

  const inferredTarget = ((): ConvertTarget => {
    const t = item.possibleType ?? item.type;
    if (!t || t === 'unclassified') return 'task';
    return t as ConvertTarget;
  })();

  const [target, setTarget] = useState<ConvertTarget>(inferredTarget);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.body || '');
  const [ventureId, setVentureId] = useState('');
  const [nextMove, setNextMove] = useState(item.nextMove || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task-specific
  const [priority, setPriority] = useState<Priority>(
    item.urgency === 'high' ? 'high' : item.urgency === 'medium' ? 'medium' : 'low'
  );
  // Goal-specific
  const [horizon, setHorizon] = useState<GoalHorizon>('month');
  // Resource-specific
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('other');
  // Decision-specific
  const [decisionText, setDecisionText] = useState(item.body || item.title);
  // Relationship-specific — try to extract first capitalized word as name
  const [relName, setRelName] = useState(() => {
    const match = item.title.match(/^([A-Z][a-z]+)\b/);
    return match ? match[1] : '';
  });
  const [relRole, setRelRole] = useState('');

  // Validate based on current target
  function isValid(): boolean {
    if (target === 'relationship') return relName.trim().length > 0;
    return title.trim().length > 0;
  }

  async function handleConvert() {
    if (!isValid() || saving) return;
    setSaving(true);
    setError(null);

    try {
      let docRef;

      if (target === 'task') {
        const taskData: Record<string, unknown> = {
          title: title.trim(),
          notes: notes.trim() || undefined,
          status: 'todo',
          priority,
        };
        if (ventureId) {
          taskData.relatedType = 'venture';
          taskData.relatedId = ventureId;
        }
        docRef = await addDocument(COLLECTIONS.TASKS, taskData);
      } else if (target === 'idea') {
        docRef = await addDocument(COLLECTIONS.IDEAS, {
          title: title.trim(),
          description: notes.trim(),
          contextType: item.contextType,
          status: 'raw',
          potential: 'medium',
          nextMove: nextMove.trim() || undefined,
          relatedVentureId: ventureId || undefined,
        } as Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (target === 'goal') {
        docRef = await addDocument(COLLECTIONS.GOALS, {
          title: title.trim(),
          description: notes.trim(),
          horizon,
          status: 'active',
          nextMove: nextMove.trim() || undefined,
          relatedVentureId: ventureId || undefined,
        } as Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (target === 'resource') {
        docRef = await addDocument(COLLECTIONS.RESOURCES, {
          title: title.trim(),
          url: resourceUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          resourceType,
          status: 'saved',
          contextType: item.contextType,
          nextMove: nextMove.trim() || undefined,
        } as Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (target === 'decision') {
        docRef = await addDocument(COLLECTIONS.DECISIONS, {
          title: title.trim(),
          decision: decisionText.trim(),
          reasoning: notes.trim() || undefined,
          contextType: item.contextType,
          status: 'active',
        } as Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (target === 'experiment') {
        docRef = await addDocument(COLLECTIONS.EXPERIMENTS, {
          title: title.trim(),
          hypothesis: notes.trim() || title.trim(),
          status: 'idea',
          nextMove: nextMove.trim() || undefined,
          relatedVentureId: ventureId || undefined,
        } as Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (target === 'venture_note') {
        docRef = await addDocument(COLLECTIONS.VENTURES, {
          name: title.trim(),
          description: notes.trim(),
          status: 'seed',
          category: 'other',
          nextMove: nextMove.trim() || undefined,
        });
      } else if (target === 'relationship') {
        docRef = await addDocument(COLLECTIONS.RELATIONSHIPS, {
          name: relName.trim(),
          role: relRole.trim() || undefined,
          notes: notes.trim() || undefined,
          nextAction: nextMove.trim() || undefined,
          relatedVentureId: ventureId || undefined,
          tags: item.tags || [],
          sourceInboxId: item.id,
        } as Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>);
      }

      if (docRef) {
        onConverted({ type: target, id: docRef.id });
      } else {
        setError('Conversion produced no record. Try again.');
        setSaving(false);
      }
    } catch (err) {
      console.error('[ConvertModal]', err);
      setError('Failed to save. Check your connection and try again.');
      setSaving(false);
    }
  }

  const activeVentures = ventures.filter((v) => v.status !== 'archived');

  return (
    <Modal open onClose={onClose} title="Convert to Record" width={480}>
      <div className={styles.form}>
        <div className={styles.convertSource}>
          <span className={styles.convertSourceLabel}>From inbox:</span>
          <span className={styles.convertSourceText}>{item.rawInput || item.title}</span>
        </div>

        <FormField label="Convert to">
          <Select value={target} onChange={(e) => { setTarget(e.target.value as ConvertTarget); setError(null); }}>
            <option value="task">Task</option>
            <option value="idea">Idea</option>
            <option value="goal">Goal</option>
            <option value="resource">Resource</option>
            <option value="decision">Decision</option>
            <option value="experiment">Experiment</option>
            <option value="venture_note">Venture</option>
            <option value="relationship">Relationship</option>
          </Select>
        </FormField>

        {target === 'relationship' ? (
          <>
            <FormRow>
              <FormField label="Name" required>
                <Input
                  autoFocus
                  value={relName}
                  onChange={(e) => setRelName(e.target.value)}
                  placeholder="Person's name"
                />
              </FormField>
              <FormField label="Role / What they do">
                <Input
                  value={relRole}
                  onChange={(e) => setRelRole(e.target.value)}
                  placeholder="e.g. knows roofing contractors"
                />
              </FormField>
            </FormRow>
            <FormField label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context about this person"
              />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            {target === 'decision' && (
              <FormField label="Decision text">
                <Textarea
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="What was decided?"
                />
              </FormField>
            )}
            <FormField label={target === 'experiment' ? 'Hypothesis' : 'Notes'}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </FormField>
            {target === 'task' && (
              <FormField label="Priority">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </FormField>
            )}
            {target === 'goal' && (
              <FormField label="Horizon">
                <Select value={horizon} onChange={(e) => setHorizon(e.target.value as GoalHorizon)}>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="quarter">This quarter</option>
                  <option value="year">This year</option>
                  <option value="life">Life</option>
                </Select>
              </FormField>
            )}
            {target === 'resource' && (
              <FormRow>
                <FormField label="URL">
                  <Input
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </FormField>
                <FormField label="Type">
                  <Select value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)}>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="book">Book</option>
                    <option value="course">Course</option>
                    <option value="tool">Tool</option>
                    <option value="doc">Doc</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
              </FormRow>
            )}
          </>
        )}

        {target !== 'decision' && (
          <FormField label="Next move">
            <Input
              value={nextMove}
              onChange={(e) => setNextMove(e.target.value)}
              placeholder="Immediate next step after conversion"
            />
          </FormField>
        )}

        {activeVentures.length > 0 && (
          <FormField label="Link to venture">
            <Select value={ventureId} onChange={(e) => setVentureId(e.target.value)}>
              <option value="">No venture</option>
              {activeVentures.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        {error && <p className={styles.formError}>{error}</p>}

        <FormActions>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleConvert} disabled={saving || !isValid()}>
            {saving ? 'Converting…' : `Convert to ${target.replace('_', ' ')} →`}
          </Btn>
        </FormActions>
      </div>
    </Modal>
  );
}
