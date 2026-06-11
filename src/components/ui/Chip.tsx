import styles from './Chip.module.css';

interface ChipProps {
  label: string;
  color?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

export function Chip({ label, color = 'default', size = 'sm' }: ChipProps) {
  return (
    <span className={`${styles.chip} ${styles[color]} ${styles[size]}`}>
      {label}
    </span>
  );
}

const STATUS_COLORS: Record<string, ChipProps['color']> = {
  // inbox
  captured: 'default',
  reviewed: 'info',
  converted: 'success',
  archived: 'default',
  // ideas
  raw: 'default',
  thinking: 'info',
  testing: 'warning',
  launching: 'accent',
  parked: 'default',
  // ventures
  seed: 'purple',
  active: 'success',
  paused: 'warning',
  validating: 'info',
  launched: 'accent',
  // goals
  completed: 'success',
  // tasks
  todo: 'default',
  doing: 'warning',
  done: 'success',
  // resources
  saved: 'default',
  studying: 'warning',
  applied: 'success',
  // decisions
  reversed: 'danger',
  // experiments
  idea: 'purple',
  running: 'warning',
  abandoned: 'danger',
};

const PRIORITY_COLORS: Record<string, ChipProps['color']> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

export function StatusChip({ status }: { status: string }) {
  return <Chip label={status} color={STATUS_COLORS[status] ?? 'default'} />;
}

export function PriorityChip({ priority }: { priority: string }) {
  return <Chip label={priority} color={PRIORITY_COLORS[priority] ?? 'default'} />;
}

export function UrgencyChip({ urgency }: { urgency: string }) {
  return <Chip label={urgency} color={PRIORITY_COLORS[urgency] ?? 'default'} />;
}
