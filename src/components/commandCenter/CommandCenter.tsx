import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import type {
  InboxItem, Venture, Goal, Task, Idea, Resource, Decision, Experiment, Relationship,
} from '../../types';
import styles from './CommandCenter.module.css';

// ── Static constants ────────────────────────────────────────────────────────

interface CommandDef {
  kind: 'command';
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'create' | 'navigate';
}

interface ResultDef {
  kind: 'result';
  id: string;
  type: string;
  title: string;
  status: string;
  sub: string;
  preview: string;
  route: string;
}

type Item = CommandDef | ResultDef;

const COMMANDS: CommandDef[] = [
  { kind: 'command', id: 'capture',       label: 'New Inbox Item',  description: 'Capture a thought, task, or idea',  icon: '+',  category: 'create'   },
  { kind: 'command', id: 'new-venture',   label: 'New Venture',     description: 'Go to Ventures to create',          icon: '◈',  category: 'create'   },
  { kind: 'command', id: 'new-goal',      label: 'New Goal',        description: 'Go to Goals to create',             icon: '◉',  category: 'create'   },
  { kind: 'command', id: 'new-task',      label: 'New Task',        description: 'Go to Tasks to create',             icon: '□',  category: 'create'   },
  { kind: 'command', id: 'goto-mc',       label: 'Mission Control', description: 'Go to Mission Control',             icon: '⌂',  category: 'navigate' },
  { kind: 'command', id: 'goto-inbox',    label: 'Inbox',           description: 'Go to Inbox',                       icon: '↓',  category: 'navigate' },
  { kind: 'command', id: 'goto-ventures', label: 'Ventures',        description: 'Go to Ventures',                    icon: '◈',  category: 'navigate' },
  { kind: 'command', id: 'goto-goals',    label: 'Goals',           description: 'Go to Goals',                       icon: '◉',  category: 'navigate' },
  { kind: 'command', id: 'goto-tasks',    label: 'Tasks',           description: 'Go to Tasks',                       icon: '□',  category: 'navigate' },
  { kind: 'command', id: 'goto-rels',     label: 'Relationships',   description: 'Go to Relationships',               icon: '◎',  category: 'navigate' },
];

const COMMAND_ROUTES: Record<string, string> = {
  'new-venture':   '/ventures',
  'new-goal':      '/goals',
  'new-task':      '/tasks',
  'goto-mc':       '/',
  'goto-inbox':    '/inbox',
  'goto-ventures': '/ventures',
  'goto-goals':    '/goals',
  'goto-tasks':    '/tasks',
  'goto-rels':     '/relationships',
};

const TYPE_LABELS: Record<string, string> = {
  inbox: 'INBOX', venture: 'VENTURE', goal: 'GOAL', task: 'TASK',
  idea: 'IDEA', resource: 'RESOURCE', decision: 'DECISION',
  experiment: 'EXPERIMENT', relationship: 'RELATIONSHIP',
};

const MAX_PER_TYPE = 5;

const CREATE_COUNT = COMMANDS.filter((c) => c.category === 'create').length;

// ── Component ───────────────────────────────────────────────────────────────

export function CommandCenter() {
  const navigate = useNavigate();

  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Subscribe to all collections for live search
  const { items: allInbox }         = useCollection<InboxItem>(COLLECTIONS.INBOX);
  const { items: allVentures }      = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: allGoals }         = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: allTasks }         = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: allIdeas }         = useCollection<Idea>(COLLECTIONS.IDEAS);
  const { items: allResources }     = useCollection<Resource>(COLLECTIONS.RESOURCES);
  const { items: allDecisions }     = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: allExperiments }   = useCollection<Experiment>(COLLECTIONS.EXPERIMENTS);
  const { items: allRelationships } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);

  // Pre-build name maps for sub-labels
  const ventureMap = useMemo(
    () => Object.fromEntries(allVentures.map((v) => [v.id, v.name])),
    [allVentures],
  );
  const goalMap = useMemo(
    () => Object.fromEntries(allGoals.map((g) => [g.id, g.title])),
    [allGoals],
  );

  // ── Search ────────────────────────────────────────────────────────────────

  const results = useMemo((): ResultDef[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const match = (...strs: (string | undefined | null)[]) =>
      strs.some((s) => s?.toLowerCase().includes(q));

    type SubSource = {
      relatedGoalId?: string;
      relatedVentureId?: string;
      relatedId?: string;
      relatedType?: string;
    };
    const sub = (item: SubSource): string => {
      if (item.relatedGoalId) return goalMap[item.relatedGoalId] || '';
      if (item.relatedVentureId) return ventureMap[item.relatedVentureId] || '';
      if (item.relatedType === 'venture' && item.relatedId) return ventureMap[item.relatedId] || '';
      return '';
    };

    const all: ResultDef[] = [];

    // Inbox
    allInbox
      .filter((i) => i.status !== 'archived' && match(i.title, i.body, i.rawInput))
      .forEach((i) =>
        all.push({ kind: 'result', id: i.id, type: 'inbox', title: i.title, status: i.status, sub: '', preview: (i.body || '').slice(0, 70), route: '/inbox' }),
      );

    // Ventures
    allVentures
      .filter((v) => v.status !== 'archived' && match(v.name, v.description, v.currentFocus, v.nextMove))
      .forEach((v) =>
        all.push({ kind: 'result', id: v.id, type: 'venture', title: v.name, status: v.status, sub: '', preview: (v.currentFocus || v.description || '').slice(0, 70), route: `/ventures/${v.id}` }),
      );

    // Goals
    allGoals
      .filter((g) => g.status !== 'archived' && match(g.title, g.description, g.nextMove))
      .forEach((g) =>
        all.push({ kind: 'result', id: g.id, type: 'goal', title: g.title, status: g.horizon, sub: '', preview: (g.description || g.nextMove || '').slice(0, 70), route: `/goals/${g.id}` }),
      );

    // Tasks
    allTasks
      .filter((t) => t.status !== 'archived' && match(t.title, t.notes))
      .forEach((t) =>
        all.push({ kind: 'result', id: t.id, type: 'task', title: t.title, status: t.priority, sub: sub(t), preview: (t.notes || '').slice(0, 70), route: '/tasks' }),
      );

    // Ideas
    allIdeas
      .filter((i) => !['archived', 'parked'].includes(i.status) && match(i.title, i.description, i.nextMove))
      .forEach((i) =>
        all.push({ kind: 'result', id: i.id, type: 'idea', title: i.title, status: i.status, sub: sub(i), preview: (i.description || '').slice(0, 70), route: '/ideas' }),
      );

    // Resources
    allResources
      .filter((r) => r.status !== 'archived' && match(r.title, r.url, r.notes))
      .forEach((r) =>
        all.push({ kind: 'result', id: r.id, type: 'resource', title: r.title, status: r.resourceType, sub: sub(r), preview: (r.url || r.notes || '').slice(0, 70), route: '/resources' }),
      );

    // Decisions
    allDecisions
      .filter((d) => d.status !== 'archived' && match(d.title, d.decision, d.reasoning))
      .forEach((d) =>
        all.push({ kind: 'result', id: d.id, type: 'decision', title: d.title, status: d.status, sub: sub(d), preview: (d.decision || '').slice(0, 70), route: '/decisions' }),
      );

    // Experiments
    allExperiments
      .filter((e) => !['completed', 'abandoned'].includes(e.status) && match(e.title, e.hypothesis))
      .forEach((e) =>
        all.push({ kind: 'result', id: e.id, type: 'experiment', title: e.title, status: e.status, sub: sub(e), preview: (e.hypothesis || '').slice(0, 70), route: '/experiments' }),
      );

    // Relationships
    allRelationships
      .filter((r) => match(r.name, r.role, r.notes, r.nextAction))
      .forEach((r) =>
        all.push({ kind: 'result', id: r.id, type: 'relationship', title: r.name, status: r.role || '', sub: sub(r), preview: (r.notes || r.nextAction || '').slice(0, 70), route: '/relationships' }),
      );

    // Cap per type
    const grouped = new Map<string, ResultDef[]>();
    for (const item of all) {
      if (!grouped.has(item.type)) grouped.set(item.type, []);
      grouped.get(item.type)!.push(item);
    }
    return Array.from(grouped.values()).flatMap((items) => items.slice(0, MAX_PER_TYPE));
  }, [query, allInbox, allVentures, allGoals, allTasks, allIdeas, allResources, allDecisions, allExperiments, allRelationships, ventureMap, goalMap]);

  // ── Flat items for keyboard navigation ───────────────────────────────────

  const isEmpty = !query.trim();
  const flatItems: Item[] = isEmpty ? COMMANDS : results;

  // Group results for display (only used when non-empty query)
  const groups = useMemo((): { type: string; items: ResultDef[] }[] => {
    const map = new Map<string, ResultDef[]>();
    for (const r of results) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type)!.push(r);
    }
    return Array.from(map.entries()).map(([type, items]) => ({ type, items }));
  }, [results]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Clamp when items list shrinks
  useEffect(() => {
    setSelectedIdx((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // ── Execute ───────────────────────────────────────────────────────────────

  function close() { setOpen(false); setQuery(''); setSelectedIdx(0); }

  function executeItem(item: Item) {
    close();
    if (item.kind === 'result') { navigate(item.route); return; }
    if (item.id === 'capture') {
      window.dispatchEvent(new CustomEvent('megaapp:open-capture'));
      return;
    }
    const route = COMMAND_ROUTES[item.id];
    if (route) navigate(route);
  }

  // Mobile: open via event from search icon in MobileHeader
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('megaapp:open-command', handler as EventListener);
    return () => window.removeEventListener('megaapp:open-command', handler as EventListener);
  }, []);

  // ── Global keyboard handler ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[selectedIdx];
        if (item) executeItem(item);
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIdx, flatItems]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            autoFocus
            className={styles.searchInput}
            placeholder="Search or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Results / commands */}
        <div className={styles.resultsList}>
          {isEmpty ? (
            <>
              <div className={styles.groupLabel}>Create</div>
              {COMMANDS.filter((c) => c.category === 'create').map((cmd, i) => (
                <button
                  key={cmd.id}
                  ref={i === selectedIdx ? selectedRef : undefined}
                  className={`${styles.item} ${i === selectedIdx ? styles.selected : ''}`}
                  onClick={() => executeItem(cmd)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className={styles.cmdIcon}>{cmd.icon}</span>
                  <span className={styles.cmdLabel}>{cmd.label}</span>
                  <span className={styles.cmdDesc}>{cmd.description}</span>
                </button>
              ))}
              <div className={styles.divider} />
              <div className={styles.groupLabel}>Navigate</div>
              {COMMANDS.filter((c) => c.category === 'navigate').map((cmd, i) => {
                const idx = CREATE_COUNT + i;
                return (
                  <button
                    key={cmd.id}
                    ref={idx === selectedIdx ? selectedRef : undefined}
                    className={`${styles.item} ${idx === selectedIdx ? styles.selected : ''}`}
                    onClick={() => executeItem(cmd)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span className={styles.cmdIcon}>{cmd.icon}</span>
                    <span className={styles.cmdLabel}>{cmd.label}</span>
                    <span className={styles.cmdDesc}>{cmd.description}</span>
                  </button>
                );
              })}
            </>
          ) : results.length === 0 ? (
            <p className={styles.emptyState}>No results for &ldquo;{query}&rdquo;</p>
          ) : (
            (() => {
              let flatIdx = 0;
              return groups.map((group) => (
                <div key={group.type}>
                  <div className={styles.groupLabel}>
                    {TYPE_LABELS[group.type] || group.type} &nbsp;{group.items.length}
                  </div>
                  {group.items.map((item) => {
                    const idx = flatIdx++;
                    return (
                      <button
                        key={item.id}
                        ref={idx === selectedIdx ? selectedRef : undefined}
                        className={`${styles.item} ${idx === selectedIdx ? styles.selected : ''}`}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                      >
                        <span className={`${styles.resultType} ${styles[`type_${item.type}`]}`}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                        <span className={styles.resultTitle}>{item.title}</span>
                        {item.status && (
                          <span className={styles.resultStatus}>{item.status}</span>
                        )}
                        {item.sub && (
                          <span className={styles.resultSub}>↪ {item.sub}</span>
                        )}
                        {item.preview && !item.sub && (
                          <span className={styles.resultPreview}>{item.preview}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.hint}>
            <kbd className={styles.hintKey}>↑</kbd>
            <kbd className={styles.hintKey}>↓</kbd>
            navigate
          </span>
          <span className={styles.hint}>
            <kbd className={styles.hintKey}>↵</kbd>
            select
          </span>
          <span className={styles.hint}>
            <kbd className={styles.hintKey}>esc</kbd>
            close
          </span>
        </div>

      </div>
    </div>
  );
}
