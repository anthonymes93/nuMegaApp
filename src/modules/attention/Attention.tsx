import { useNavigate } from 'react-router-dom';
import { useAttentionItems } from '../../hooks/useAttentionItems';
import type { AttentionItem } from '../../types';
import styles from './Attention.module.css';

function timeAgo(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo === 1) return '1mo ago';
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const navigate = useNavigate();
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <span className={`${styles.typeBadge} ${styles[`type_${item.type}`]}`}>
          {item.type}
        </span>
        <div className={styles.rowContent}>
          <span className={styles.rowTitle}>{item.title}</span>
          <span className={styles.rowReason}>{item.reason}</span>
          <span className={styles.rowMeta}>{timeAgo(item.createdAt)}</span>
        </div>
      </div>
      <button className={styles.rowAction} onClick={() => navigate(item.targetRoute)}>
        {item.actionLabel} →
      </button>
    </div>
  );
}

interface GroupProps {
  label: string;
  items: AttentionItem[];
  labelClass: string;
}

function AttentionGroup({ label, items, labelClass }: GroupProps) {
  if (items.length === 0) return null;
  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <span className={`${styles.groupLabel} ${labelClass}`}>{label}</span>
        <span className={styles.groupCount}>{items.length}</span>
      </div>
      <div className={styles.list}>
        {items.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function Attention() {
  const items = useAttentionItems();

  const high   = items.filter((i) => i.severity === 'high');
  const medium = items.filter((i) => i.severity === 'medium');
  const low    = items.filter((i) => i.severity === 'low');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Attention</span>
          <span className={styles.subtitle}>
            Computed from active ventures, goals, relationships, ideas, and decisions.
          </span>
        </div>
        <span className={styles.totalBadge}>{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>✓</div>
          <div className={styles.emptyTitle}>Nothing needs attention right now.</div>
          <div className={styles.emptySub}>All active items are in good shape.</div>
        </div>
      ) : (
        <>
          <AttentionGroup label="HIGH" items={high} labelClass={styles.labelHigh} />
          <AttentionGroup label="MEDIUM" items={medium} labelClass={styles.labelMedium} />
          <AttentionGroup label="LOW" items={low} labelClass={styles.labelLow} />
        </>
      )}
    </div>
  );
}
