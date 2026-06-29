import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { Modal } from '../../components/ui/Modal';
import type {
  InboxItem, Task, Venture, Goal, Decision, Relationship, AttentionItem,
} from '../../types';
import styles from './QuickViewModal.module.css';

export type QuickViewItem =
  | { kind: 'inbox';        item: InboxItem }
  | { kind: 'task';         item: Task }
  | { kind: 'venture';      item: Venture }
  | { kind: 'goal';         item: Goal }
  | { kind: 'decision';     item: Decision }
  | { kind: 'relationship'; item: Relationship }
  | { kind: 'attention';    item: AttentionItem };

interface Props {
  qv: QuickViewItem | null;
  onClose: () => void;
}

const KIND_LABELS: Record<QuickViewItem['kind'], string> = {
  inbox:        'Inbox Item',
  task:         'Task',
  venture:      'Venture',
  goal:         'Goal',
  decision:     'Decision',
  relationship: 'Relationship',
  attention:    'Attention Item',
};

function getDisplayTitle(qv: QuickViewItem): string {
  if (qv.kind === 'venture' || qv.kind === 'relationship') return qv.item.name;
  return qv.item.title;
}

function getFullRoute(qv: QuickViewItem): string {
  switch (qv.kind) {
    case 'inbox':        return '/inbox';
    case 'task':         return '/tasks';
    case 'venture':      return `/ventures/${qv.item.id}`;
    case 'goal':         return `/goals/${qv.item.id}`;
    case 'decision':     return '/decisions';
    case 'relationship': return '/relationships';
    case 'attention':    return qv.item.targetRoute;
  }
}

function fmtTs(ts: Timestamp): string {
  return format(ts.toDate(), 'MMM d, yyyy');
}

/** Returns val only if it's non-empty and doesn't duplicate any of the `seen` values. */
function notSameAs(
  val: string | null | undefined,
  ...seen: (string | null | undefined)[]
): string | null {
  if (!val?.trim()) return null;
  const norm = val.trim().toLowerCase();
  for (const s of seen) {
    if (s?.trim().toLowerCase() === norm) return null;
  }
  return val.trim();
}

function Field({ label, value }: { label: string; value?: string | null }): ReactNode {
  if (!value) return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <p className={styles.fieldValue}>{value}</p>
    </div>
  );
}

function Chip({ label, cls }: { label: string; cls?: string }) {
  return <span className={`${styles.chip} ${cls ?? ''}`}>{label}</span>;
}

function renderChips(qv: QuickViewItem): ReactNode {
  switch (qv.kind) {
    case 'inbox':
      return <>
        {qv.item.possibleType && qv.item.possibleType !== 'unclassified' && (
          <Chip label={qv.item.possibleType.replace('_', ' ')} />
        )}
        <Chip label={qv.item.urgency} cls={styles[`urgency_${qv.item.urgency}`]} />
        <Chip label={qv.item.status} />
      </>;
    case 'task':
      return <>
        <Chip label={qv.item.priority} cls={styles[`priority_${qv.item.priority}`]} />
        <Chip label={qv.item.status} />
      </>;
    case 'venture':
      return <>
        <Chip label={qv.item.status} cls={styles[`vstatus_${qv.item.status}`]} />
        <Chip label={qv.item.category} />
      </>;
    case 'goal':
      return <>
        <Chip label={qv.item.status} />
        <Chip label={qv.item.horizon} />
      </>;
    case 'decision':
      return <Chip label={qv.item.status} />;
    case 'relationship':
      return qv.item.role ? <Chip label={qv.item.role} /> : null;
    case 'attention':
      return <>
        <Chip label={qv.item.severity.toUpperCase()} cls={styles[`sev_${qv.item.severity}`]} />
        <Chip label={qv.item.type} />
      </>;
  }
}

/** Renders supplementary fields, deduplicating against the already-shown title. */
function renderFields(qv: QuickViewItem, title: string): ReactNode {
  switch (qv.kind) {
    case 'inbox': {
      // title already shows the captured text; only surface body/rawInput if genuinely different
      const extra = notSameAs(qv.item.body, title)
                 ?? notSameAs(qv.item.rawInput, title);
      return <>
        {extra && <Field label="Notes" value={extra} />}
        {qv.item.tags?.length ? (
          <div className={styles.tags}>
            {qv.item.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        ) : null}
      </>;
    }

    case 'task':
      return <>
        <Field label="Notes" value={notSameAs(qv.item.notes, title)} />
        {qv.item.dueAt && <Field label="Due" value={fmtTs(qv.item.dueAt)} />}
      </>;

    case 'venture': {
      const desc = notSameAs(qv.item.description, title);
      return <>
        <Field label="Description"   value={desc} />
        <Field label="Current focus" value={notSameAs(qv.item.currentFocus, title, desc)} />
        <Field label="Next move"     value={notSameAs(qv.item.nextMove, title, desc)} />
      </>;
    }

    case 'goal': {
      const desc = notSameAs(qv.item.description, title);
      return <>
        <Field label="Description" value={desc} />
        <Field label="Next move"   value={notSameAs(qv.item.nextMove, title, desc)} />
      </>;
    }

    case 'decision': {
      const decision = notSameAs(qv.item.decision, title);
      return <>
        <Field label="Decision"  value={decision} />
        <Field label="Reasoning" value={notSameAs(qv.item.reasoning, title, decision)} />
      </>;
    }

    case 'relationship': {
      const notes = notSameAs(qv.item.notes, title);
      return <>
        <Field label="Notes"       value={notes} />
        <Field label="Next action" value={notSameAs(qv.item.nextAction, title, notes)} />
        {qv.item.nextActionDate && <Field label="Due" value={fmtTs(qv.item.nextActionDate)} />}
      </>;
    }

    case 'attention':
      return <>
        <Field label="Reason"           value={notSameAs(qv.item.reason, title)} />
        <Field label="Suggested action" value={notSameAs(qv.item.actionLabel, title)} />
      </>;
  }
}

export function QuickViewModal({ qv, onClose }: Props) {
  const navigate = useNavigate();

  if (!qv) return null;

  function openFull() {
    onClose();
    navigate(getFullRoute(qv!));
  }

  const title  = getDisplayTitle(qv);
  const chips  = renderChips(qv);
  const fields = renderFields(qv, title);

  const createdAt = qv.kind !== 'attention' ? qv.item.createdAt : null;
  const updatedAt = qv.kind !== 'attention' ? qv.item.updatedAt : null;

  return (
    <Modal open={true} onClose={onClose} title={KIND_LABELS[qv.kind]} width={500}>
      <div className={styles.body}>
        {chips && <div className={styles.chips}>{chips}</div>}
        <h3 className={styles.itemTitle}>{title}</h3>
        {fields && <div className={styles.fields}>{fields}</div>}
        {createdAt && (
          <div className={styles.dates}>
            <span>Created {fmtTs(createdAt)}</span>
            {updatedAt && <span>Updated {fmtTs(updatedAt)}</span>}
          </div>
        )}
        <div className={styles.actions}>
          <button className={styles.actionPrimary} onClick={openFull}>
            Open full page →
          </button>
          <button className={styles.actionClose} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
