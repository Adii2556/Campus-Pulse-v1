import { CATEGORY_META, PRIORITY_META, STATUS_META } from '../lib/meta';
import type { Category, Priority, ItemStatus } from '../lib/types';

export function CategoryChip({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span className={`chip border ${meta.chip}`}>
      <Icon size={12} strokeWidth={2.4} />
      {category}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <span className={`chip border ${meta.chip}`}>{meta.label}</span>;
}

export function StatusChip({ status }: { status: ItemStatus }) {
  const meta = STATUS_META[status];
  return <span className={`chip border ${meta.chip}`}>{meta.label}</span>;
}

export function LifecycleChip({ kind }: { kind: 'cancelled' | 'postponed' }) {
  return (
    <span className="chip border border-stone-400 bg-stone-200 text-stone-600">
      {kind === 'cancelled' ? 'Cancelled' : 'Postponed'}
    </span>
  );
}

/** red rubber-stamp effect for critical items */
export function CriticalStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-3 top-3 select-none rounded-md border-[2.5px] border-red-600/80 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-red-700/80"
      style={{ transform: 'rotate(7deg)' }}
    >
      Urgent
    </span>
  );
}
