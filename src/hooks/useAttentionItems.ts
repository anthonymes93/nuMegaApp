import { useMemo } from 'react';
import { useCollection } from './useCollection';
import { COLLECTIONS } from '../lib/firestore';
import type { AttentionItem, Venture, Goal, Relationship, Idea, Decision } from '../types';

function toMs(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  return (ts as { toMillis?: () => number }).toMillis?.() ?? 0;
}

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const MS_60_DAYS = 60 * 24 * 60 * 60 * 1000;

const HORIZON_OVERDUE_MS: Record<string, number> = {
  today:   1 * 24 * 60 * 60 * 1000,
  week:    7 * 24 * 60 * 60 * 1000,
  month:  30 * 24 * 60 * 60 * 1000,
  quarter: 90 * 24 * 60 * 60 * 1000,
  year:  365 * 24 * 60 * 60 * 1000,
};

export function useAttentionItems(): AttentionItem[] {
  const { items: ventures }      = useCollection<Venture>(COLLECTIONS.VENTURES);
  const { items: goals }         = useCollection<Goal>(COLLECTIONS.GOALS);
  const { items: relationships } = useCollection<Relationship>(COLLECTIONS.RELATIONSHIPS);
  const { items: ideas }         = useCollection<Idea>(COLLECTIONS.IDEAS);
  const { items: decisions }     = useCollection<Decision>(COLLECTIONS.DECISIONS);

  return useMemo(() => {
    const now = Date.now();
    const out: AttentionItem[] = [];

    // ── VENTURES ────────────────────────────────────────────────────────────
    for (const v of ventures) {
      if (v.status === 'archived') continue;

      if (!v.nextMove) {
        out.push({
          id: `venture_${v.id}_no-next-move`,
          type: 'venture',
          severity: 'high',
          title: v.name,
          reason: 'Venture has no next move defined.',
          actionLabel: 'Define Next Move',
          targetRoute: `/ventures/${v.id}`,
          createdAt: toMs(v.createdAt),
        });
      }

      if (!v.relatedGoalId) {
        out.push({
          id: `venture_${v.id}_no-goal`,
          type: 'venture',
          severity: 'medium',
          title: v.name,
          reason: 'Venture is not linked to any goal.',
          actionLabel: 'Link a Goal',
          targetRoute: `/ventures/${v.id}`,
          createdAt: toMs(v.createdAt),
        });
      }

      if (['active', 'validating'].includes(v.status)) {
        const updatedMs = toMs(v.updatedAt);
        if (updatedMs > 0 && now - updatedMs > MS_30_DAYS) {
          const days = Math.floor((now - updatedMs) / 86400000);
          out.push({
            id: `venture_${v.id}_stale`,
            type: 'venture',
            severity: 'medium',
            title: v.name,
            reason: `Not updated in ${days} days.`,
            actionLabel: 'Review Venture',
            targetRoute: `/ventures/${v.id}`,
            createdAt: toMs(v.createdAt),
          });
        }
      }
    }

    // ── GOALS ────────────────────────────────────────────────────────────────
    const activeVentureGoalIds = new Set(
      ventures
        .filter((v) => ['active', 'validating', 'launched'].includes(v.status) && v.relatedGoalId)
        .map((v) => v.relatedGoalId as string)
    );

    for (const g of goals) {
      if (g.status !== 'active') continue;

      if (!activeVentureGoalIds.has(g.id)) {
        out.push({
          id: `goal_${g.id}_no-ventures`,
          type: 'goal',
          severity: 'medium',
          title: g.title,
          reason: 'No active ventures are working toward this goal.',
          actionLabel: 'Link a Venture',
          targetRoute: `/goals/${g.id}`,
          createdAt: toMs(g.createdAt),
        });
      }

      const overdueWindow = HORIZON_OVERDUE_MS[g.horizon];
      if (overdueWindow) {
        const createdMs = toMs(g.createdAt);
        if (createdMs > 0 && now - createdMs > overdueWindow) {
          out.push({
            id: `goal_${g.id}_overdue`,
            type: 'goal',
            severity: 'high',
            title: g.title,
            reason: `Active longer than its "${g.horizon}" horizon suggests.`,
            actionLabel: 'Review Goal',
            targetRoute: `/goals/${g.id}`,
            createdAt: createdMs,
          });
        }
      }

      const updatedMs = toMs(g.updatedAt);
      if (updatedMs > 0 && now - updatedMs > MS_30_DAYS) {
        const days = Math.floor((now - updatedMs) / 86400000);
        out.push({
          id: `goal_${g.id}_stale`,
          type: 'goal',
          severity: 'medium',
          title: g.title,
          reason: `Not updated in ${days} days.`,
          actionLabel: 'Review Goal',
          targetRoute: `/goals/${g.id}`,
          createdAt: toMs(g.createdAt),
        });
      }
    }

    // ── RELATIONSHIPS ────────────────────────────────────────────────────────
    for (const r of relationships) {
      if (r.nextActionDate) {
        const dateMs = toMs(r.nextActionDate);
        if (dateMs > 0 && dateMs < now) {
          out.push({
            id: `rel_${r.id}_date-passed`,
            type: 'relationship',
            severity: 'high',
            title: r.name,
            reason: r.nextAction
              ? `Follow-up date passed: "${r.nextAction}".`
              : 'Scheduled follow-up date has passed.',
            actionLabel: 'Follow Up',
            targetRoute: '/relationships',
            createdAt: toMs(r.createdAt),
          });
        }
      } else if (r.nextAction) {
        out.push({
          id: `rel_${r.id}_no-date`,
          type: 'relationship',
          severity: 'medium',
          title: r.name,
          reason: `Has follow-up "${r.nextAction}" but no date is set.`,
          actionLabel: 'Set Date',
          targetRoute: '/relationships',
          createdAt: toMs(r.createdAt),
        });
      }
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────────
    for (const i of ideas) {
      if (['archived', 'parked', 'testing', 'launching'].includes(i.status)) continue;
      const createdMs = toMs(i.createdAt);
      if (createdMs > 0 && now - createdMs > MS_60_DAYS) {
        out.push({
          id: `idea_${i.id}_stale`,
          type: 'idea',
          severity: 'low',
          title: i.title,
          reason: `In "${i.status}" for over 60 days without being promoted.`,
          actionLabel: 'Promote Idea',
          targetRoute: '/ideas',
          createdAt: createdMs,
        });
      }
    }

    // ── DECISIONS ─────────────────────────────────────────────────────────────
    for (const d of decisions) {
      if (d.status !== 'active') continue;
      if (!d.reasoning) {
        out.push({
          id: `decision_${d.id}_no-reasoning`,
          type: 'decision',
          severity: 'medium',
          title: d.title,
          reason: 'Decision was made but reasoning is not documented.',
          actionLabel: 'Add Reasoning',
          targetRoute: '/decisions',
          createdAt: toMs(d.createdAt),
        });
      }
    }

    return out;
  }, [ventures, goals, relationships, ideas, decisions]);
}
