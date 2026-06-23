import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useCollection } from '../../hooks/useCollection';
import { useAttentionItems } from '../../hooks/useAttentionItems';
import { COLLECTIONS } from '../../lib/firestore';
import type { InboxItem, Task, Venture, Goal, Decision, Relationship } from '../../types';
import styles from './MissionControl.module.css';

export function MissionControl() {
  const navigate = useNavigate();
  const { items: inbox }         = useCollection<InboxItem>(COLLECTIONS.INBOX);
  const { items: tasks }         = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: ventures }      = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: goals }         = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: decisions }     = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: relationships } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);
  const attention = useAttentionItems();

  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  const inboxQueue = useMemo(
    () => inbox.filter((i) => i.status === 'captured'),
    [inbox]
  );

  const staleTasks = useMemo(
    () => tasks.filter(
      (t) => (t.status === 'todo' || t.status === 'doing') &&
        t.createdAt?.toMillis?.() < now - fourteenDays
    ),
    [tasks, now]
  );

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'todo' || t.status === 'doing'),
    [tasks]
  );

  const stuckVentures = useMemo(
    () => ventures.filter((v) => (v.status === 'active' || v.status === 'validating') && !v.nextMove),
    [ventures]
  );

  const stuckGoals = useMemo(
    () => goals.filter((g) => g.status === 'active' && !g.nextMove),
    [goals]
  );

  const goalsInMotion = useMemo(
    () => goals.filter((g) => {
      if (g.status !== 'active') return false;
      return ventures.some(
        (v) => v.relatedGoalId === g.id && ['active', 'validating', 'launched'].includes(v.status)
      );
    }),
    [goals, ventures]
  );

  const openDecisions = useMemo(
    () => decisions.filter((d) => d.status === 'active' && !d.reasoning),
    [decisions]
  );

  const followUps = useMemo(
    () => relationships.filter((r) => r.nextAction),
    [relationships]
  );

  const topAttention = useMemo(() => {
    const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...attention]
      .sort((a, b) => {
        const diff = sevOrder[a.severity] - sevOrder[b.severity];
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      })
      .slice(0, 10);
  }, [attention]);

  const totalAttention = inboxQueue.length + staleTasks.length + stuckVentures.length +
    stuckGoals.length + openDecisions.length + followUps.length;

  return (
    <div className={styles.page}>

      <div className={styles.commandHeader}>
        <div className={styles.commandLeft}>
          <div className={styles.commandTitle}>
            <span className={styles.commandBrand}>MegaApp</span>
            <span className={styles.commandSep}>/</span>
            <span className={styles.commandPage}>Mission Control</span>
          </div>
          <span className={styles.commandTagline}>
            {totalAttention === 0
              ? 'All clear — nothing needs attention right now.'
              : `${totalAttention} item${totalAttention !== 1 ? 's' : ''} need${totalAttention === 1 ? 's' : ''} your attention.`}
          </span>
        </div>
        <span className={styles.commandDate}>{format(new Date(), 'EEE MMM d')}</span>
      </div>

      {/* Stats strip */}
      <div className={styles.statsStrip}>
        <StatItem label="Inbox Queue" value={inboxQueue.length} warn={inboxQueue.length > 0} nav="/inbox" />
        <StatItem label="Active Tasks" value={activeTasks.length} nav="/tasks" />
        <StatItem label="Active Ventures" value={ventures.filter((v) => v.status === 'active').length} nav="/ventures" />
        <StatItem label="Active Goals" value={goals.filter((g) => g.status === 'active').length} nav="/goals" />
        <StatItem label="Attention" value={attention.length} warn={attention.length > 0} nav="/attention" />
        <StatItem label="Follow-ups" value={followUps.length} warn={followUps.length > 0} nav="/relationships" />
      </div>

      {/* Attention grid */}
      <div className={styles.grid}>

        <AttentionPanel
          title="Inbox Queue"
          count={inboxQueue.length}
          nav="/inbox"
          warn={inboxQueue.length > 0}
          hint="Items captured, not yet processed"
        >
          {inboxQueue.length === 0 ? <Empty /> : inboxQueue.slice(0, 8).map((i) => (
            <Row key={i.id}>
              <span className={styles.rowTitle}>{i.title}</span>
              {i.possibleType && i.possibleType !== 'unclassified' && (
                <TypeTag type={i.possibleType} />
              )}
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Active Tasks"
          count={activeTasks.length}
          nav="/tasks"
        >
          {activeTasks.length === 0 ? <Empty /> : activeTasks.slice(0, 8).map((t) => (
            <Row key={t.id}>
              <span className={styles.rowTitle}>{t.title}</span>
              <span className={`${styles.priorityTag} ${styles[`p_${t.priority}`]}`}>{t.priority}</span>
              <span className={`${styles.statusTag}`}>{t.status}</span>
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Goals In Motion"
          count={goalsInMotion.length}
          nav="/goals"
          hint="Active goals with a linked active venture"
        >
          {goalsInMotion.length === 0 ? <Empty /> : goalsInMotion.slice(0, 6).map((g) => (
            <Row key={g.id}>
              <span className={styles.rowTitle}>{g.title}</span>
              <span className={styles.horizonTag}>{g.horizon}</span>
              <span className={styles.motionTag}>in motion</span>
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Stuck Ventures"
          count={stuckVentures.length}
          nav="/ventures"
          warn={stuckVentures.length > 0}
          hint="Active ventures with no next move"
        >
          {stuckVentures.length === 0 ? <Empty /> : stuckVentures.map((v) => (
            <Row key={v.id}>
              <span className={styles.rowTitle}>{v.name}</span>
              <span className={styles.stuckTag}>no next move</span>
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Stalled Goals"
          count={stuckGoals.length}
          nav="/goals"
          warn={stuckGoals.length > 0}
          hint="Active goals with no next move"
        >
          {stuckGoals.length === 0 ? <Empty /> : stuckGoals.map((g) => (
            <Row key={g.id}>
              <span className={styles.rowTitle}>{g.title}</span>
              <span className={styles.horizonTag}>{g.horizon}</span>
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Decisions Pending Reasoning"
          count={openDecisions.length}
          nav="/decisions"
          warn={openDecisions.length > 0}
        >
          {openDecisions.length === 0 ? <Empty /> : openDecisions.slice(0, 6).map((d) => (
            <Row key={d.id}>
              <span className={styles.rowTitle}>{d.title}</span>
              <span className={styles.decisionText}>{d.decision}</span>
            </Row>
          ))}
        </AttentionPanel>

        <AttentionPanel
          title="Relationship Follow-ups"
          count={followUps.length}
          nav="/relationships"
          warn={followUps.length > 0}
        >
          {followUps.length === 0 ? <Empty /> : followUps.slice(0, 6).map((r) => (
            <Row key={r.id}>
              <span className={styles.rowTitle}>{r.name}</span>
              <span className={styles.followUpText}>{r.nextAction}</span>
            </Row>
          ))}
        </AttentionPanel>

      </div>

      {/* Attention Required panel */}
      <div className={`${styles.stuckPanel} ${attention.length === 0 ? styles.stuckClear : ''}`}>
        <div className={styles.stuckHeader}>
          <div className={styles.stuckLeft}>
            <span className={styles.stuckLabel}>ATTENTION REQUIRED</span>
            <span className={styles.stuckCount}>{attention.length}</span>
          </div>
          <div className={styles.stuckMeta}>
            {attention.length === 0
              ? 'All clear.'
              : <button className={styles.stuckViewAll} onClick={() => navigate('/attention')}>View all {attention.length} →</button>}
          </div>
        </div>
        {topAttention.length > 0 && (
          <table className={styles.stuckTable}>
            <thead>
              <tr>
                <th className={styles.stuckTh}>Sev</th>
                <th className={styles.stuckTh}>Type</th>
                <th className={styles.stuckTh}>Item</th>
                <th className={styles.stuckTh}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {topAttention.map((item) => (
                <tr
                  key={item.id}
                  className={styles.stuckTr}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(item.targetRoute)}
                >
                  <td className={styles.stuckTd}>
                    <span className={`${styles.attentionSev} ${styles[`sev_${item.severity}`]}`}>
                      {item.severity.slice(0, 3).toUpperCase()}
                    </span>
                  </td>
                  <td className={styles.stuckTd}>
                    <span className={styles.stuckType}>{item.type}</span>
                  </td>
                  <td className={`${styles.stuckTd} ${styles.stuckTitle}`}>{item.title}</td>
                  <td className={`${styles.stuckTd} ${styles.stuckReason}`}>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function AttentionPanel({
  title, count, nav, warn, hint, children,
}: {
  title: string;
  count: number;
  nav?: string;
  warn?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <section className={`${styles.panel} ${warn && count > 0 ? styles.panelWarn : ''}`}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderLeft}>
          <span className={styles.panelTitle}>{title}</span>
          {hint && <span className={styles.panelHint}>{hint}</span>}
        </div>
        <div className={styles.panelMeta}>
          <span className={`${styles.panelCount} ${warn && count > 0 ? styles.panelCountWarn : ''}`}>{count}</span>
          {nav && <button className={styles.panelNav} onClick={() => navigate(nav)}>→</button>}
        </div>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

function Empty() {
  return <p className={styles.empty}>—</p>;
}

function TypeTag({ type }: { type: string }) {
  return <span className={`${styles.typeTag} ${styles[`tt_${type}`]}`}>{type.replace('_', ' ')}</span>;
}

function StatItem({
  label, value, warn, nav,
}: {
  label: string;
  value: number;
  warn?: boolean;
  nav?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={`${styles.statItem} ${nav ? styles.statClickable : ''}`}
      onClick={nav ? () => navigate(nav) : undefined}
    >
      <span className={`${styles.statVal} ${warn && value > 0 ? styles.statWarn : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
