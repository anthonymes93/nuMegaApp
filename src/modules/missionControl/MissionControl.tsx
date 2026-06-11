import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import { StatusChip, PriorityChip, UrgencyChip } from '../../components/ui/Chip';
import type { InboxItem, Task, Venture, Goal, Resource, Decision, Idea } from '../../types';
import styles from './MissionControl.module.css';

export function MissionControl() {
  const { items: inbox } = useCollection<InboxItem>(COLLECTIONS.INBOX);
  const { items: tasks } = useCollection<Task>(COLLECTIONS.TASKS);
  const { items: ventures } = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: goals } = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: resources } = useCollection<Resource>(COLLECTIONS.RESOURCES);
  const { items: decisions } = useCollection<Decision>(COLLECTIONS.DECISIONS);
  const { items: ideas } = useCollection<Idea>(COLLECTIONS.IDEAS);

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.status === 'todo' || t.status === 'doing'),
    [tasks]
  );
  const highUrgencyInbox = useMemo(
    () => inbox.filter((i) => i.urgency === 'high' && i.status !== 'archived' && i.status !== 'converted'),
    [inbox]
  );
  const activeVentures = useMemo(
    () => ventures.filter((v) => v.status === 'active' || v.status === 'validating'),
    [ventures]
  );
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const activeIdeas = useMemo(
    () => ideas.filter((i) => i.status === 'testing' || i.status === 'launching'),
    [ideas]
  );
  const studyingResources = useMemo(() => resources.filter((r) => r.status === 'studying'), [resources]);
  const recentDecisions = useMemo(
    () => decisions.filter((d) => d.status === 'active').slice(0, 5),
    [decisions]
  );

  const stuckPotential = useMemo(() => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const items: { id: string; type: string; title: string; reason: string }[] = [];
    inbox
      .filter((i) => i.status === 'captured' && !i.nextMove)
      .forEach((i) => items.push({ id: i.id, type: 'Inbox', title: i.title, reason: 'No next move' }));
    ideas
      .filter((i) => !['archived', 'parked', 'launching'].includes(i.status) && !i.nextMove)
      .forEach((i) => items.push({ id: i.id, type: 'Idea', title: i.title, reason: 'No next move' }));
    ventures
      .filter((v) => v.status === 'active' && !v.nextMove)
      .forEach((v) => items.push({ id: v.id, type: 'Venture', title: v.name, reason: 'No next move' }));
    goals
      .filter((g) => g.status === 'active' && !g.nextMove)
      .forEach((g) => items.push({ id: g.id, type: 'Goal', title: g.title, reason: 'No next move' }));
    tasks
      .filter((t) => t.status === 'todo' && t.createdAt?.toMillis?.() < twoWeeksAgo)
      .forEach((t) => items.push({ id: t.id, type: 'Task', title: t.title, reason: 'Untouched 14d+' }));
    return items.slice(0, 20);
  }, [inbox, ideas, ventures, goals, tasks]);

  return (
    <div className={styles.page}>

      {/* Command header */}
      <div className={styles.commandHeader}>
        <div className={styles.commandLeft}>
          <div className={styles.commandTitle}>
            <span className={styles.commandBrand}>MegaApp</span>
            <span className={styles.commandSep}>/</span>
            <span className={styles.commandPage}>Mission Control</span>
          </div>
          <span className={styles.commandTagline}>Stored potential → directed motion.</span>
        </div>
        <span className={styles.commandDate}>{format(new Date(), "EEE MMM d")}</span>
      </div>

      {/* Stats strip */}
      <div className={styles.statsStrip}>
        <StatItem label="Open Tasks" value={todayTasks.length} />
        <span className={styles.statSep} />
        <StatItem label="High Urgency" value={highUrgencyInbox.length} warn={highUrgencyInbox.length > 0} />
        <span className={styles.statSep} />
        <StatItem label="Active Ventures" value={activeVentures.length} />
        <span className={styles.statSep} />
        <StatItem label="Active Goals" value={activeGoals.length} />
        <span className={styles.statSep} />
        <StatItem label="Ideas in Motion" value={activeIdeas.length} />
        <span className={styles.statSep} />
        <StatItem label="Stuck" value={stuckPotential.length} warn={stuckPotential.length > 0} />
      </div>

      {/* Main grid */}
      <div className={styles.grid}>
        <Panel title="Open Tasks" count={todayTasks.length} nav="/tasks">
          {todayTasks.length === 0
            ? <Empty />
            : todayTasks.slice(0, 8).map((t) => (
                <Row key={t.id}>
                  <span className={styles.rowTitle}>{t.title}</span>
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                </Row>
              ))}
        </Panel>

        <Panel title="High Urgency Inbox" count={highUrgencyInbox.length} nav="/inbox">
          {highUrgencyInbox.length === 0
            ? <Empty />
            : highUrgencyInbox.slice(0, 8).map((i) => (
                <Row key={i.id}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <UrgencyChip urgency={i.urgency} />
                  {i.nextMove && <span className={styles.rowNext}>→ {i.nextMove}</span>}
                </Row>
              ))}
        </Panel>

        <Panel title="Active Ventures" count={activeVentures.length} nav="/ventures">
          {activeVentures.length === 0
            ? <Empty />
            : activeVentures.map((v) => (
                <Row key={v.id}>
                  <span className={styles.rowTitle}>{v.name}</span>
                  <StatusChip status={v.status} />
                  {v.nextMove && <span className={styles.rowNext}>→ {v.nextMove}</span>}
                </Row>
              ))}
        </Panel>

        <Panel title="Active Goals" count={activeGoals.length} nav="/goals">
          {activeGoals.length === 0
            ? <Empty />
            : activeGoals.slice(0, 8).map((g) => (
                <Row key={g.id}>
                  <span className={styles.rowTitle}>{g.title}</span>
                  <StatusChip status={g.horizon} />
                  {g.nextMove && <span className={styles.rowNext}>→ {g.nextMove}</span>}
                </Row>
              ))}
        </Panel>

        <Panel title="Ideas in Motion" count={activeIdeas.length} nav="/ideas">
          {activeIdeas.length === 0
            ? <Empty />
            : activeIdeas.map((i) => (
                <Row key={i.id}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <StatusChip status={i.status} />
                  {i.nextMove && <span className={styles.rowNext}>→ {i.nextMove}</span>}
                </Row>
              ))}
        </Panel>

        <Panel title="Studying" count={studyingResources.length} nav="/resources">
          {studyingResources.length === 0
            ? <Empty />
            : studyingResources.map((r) => (
                <Row key={r.id}>
                  <span className={styles.rowTitle}>{r.title}</span>
                  <StatusChip status={r.resourceType} />
                  {r.nextMove && <span className={styles.rowNext}>→ {r.nextMove}</span>}
                </Row>
              ))}
        </Panel>

        <Panel title="Recent Decisions" count={recentDecisions.length} nav="/decisions" span={2}>
          {recentDecisions.length === 0
            ? <Empty />
            : recentDecisions.map((d) => (
                <Row key={d.id}>
                  <span className={styles.rowTitle}>{d.title}</span>
                  <span className={styles.rowDecision}>{d.decision}</span>
                </Row>
              ))}
        </Panel>
      </div>

      {/* Stuck Potential */}
      <div className={`${styles.stuckPanel} ${stuckPotential.length === 0 ? styles.stuckClear : ''}`}>
        <div className={styles.stuckHeader}>
          <div className={styles.stuckLeft}>
            <span className={styles.stuckLabel}>STUCK POTENTIAL</span>
            <span className={styles.stuckCount}>{stuckPotential.length}</span>
          </div>
          <span className={styles.stuckMeta}>
            {stuckPotential.length === 0
              ? 'All items have a next move.'
              : `${stuckPotential.length} item${stuckPotential.length !== 1 ? 's' : ''} with no next move assigned.`}
          </span>
        </div>
        {stuckPotential.length > 0 && (
          <table className={styles.stuckTable}>
            <thead>
              <tr>
                <th className={styles.stuckTh}>Type</th>
                <th className={styles.stuckTh}>Title</th>
                <th className={styles.stuckTh}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {stuckPotential.map((s) => (
                <tr key={`${s.type}-${s.id}`} className={styles.stuckTr}>
                  <td className={styles.stuckTd}>
                    <span className={styles.stuckType}>{s.type}</span>
                  </td>
                  <td className={`${styles.stuckTd} ${styles.stuckTitle}`}>{s.title}</td>
                  <td className={`${styles.stuckTd} ${styles.stuckReason}`}>{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

function Panel({
  title, count, nav, children, span,
}: {
  title: string;
  count: number;
  nav?: string;
  children: React.ReactNode;
  span?: number;
}) {
  const navigate = useNavigate();
  return (
    <section
      className={styles.panel}
      style={span ? { gridColumn: `span ${span}` } : undefined}
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{title}</span>
        <div className={styles.panelMeta}>
          <span className={styles.panelCount}>{count}</span>
          {nav && (
            <button className={styles.panelNav} onClick={() => navigate(nav)}>→</button>
          )}
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

function StatItem({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={styles.statItem}>
      <span className={`${styles.statVal} ${warn && value > 0 ? styles.statWarn : ''}`}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
