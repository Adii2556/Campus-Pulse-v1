import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, X, Star, LayoutGrid, List, Flame, CalendarClock, Archive, SlidersHorizontal, Eraser } from 'lucide-react';
import { useStore, statusOfItem } from '../lib/store';
import { CATEGORIES } from '../lib/types';
import type { Category, CampusItem } from '../lib/types';
import { CATEGORY_META } from '../lib/meta';
import ItemCard from '../components/ItemCard';

type BoardView = 'board' | 'list';

export default function Board() {
  const { filtered, filters, setFilters, resetFilters, counts, savedOnly, setSavedOnly, savedIds } = useStore();
  const [view, setView] = useState<BoardView>('board');

  const todays = useMemo(() => filtered.filter((i) => statusOfItem(i) === 'today'), [filtered]);
  const overdue = useMemo(() => filtered.filter((i) => statusOfItem(i) === 'overdue'), [filtered]);
  const upcoming = useMemo(() => filtered.filter((i) => ['upcoming', 'undated'].includes(statusOfItem(i))), [filtered]);
  const past = useMemo(() => filtered.filter((i) => ['expired', 'cancelled', 'postponed'].includes(statusOfItem(i))), [filtered]);

  const hasActiveFilter =
    filters.query.trim() !== '' ||
    filters.categories.length > 0 ||
    filters.priority !== 'all' ||
    filters.status !== 'all' ||
    filters.showDone ||
    savedOnly;

  const toggleCategory = (c: Category) => {
    setFilters({
      categories: filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c],
    });
  };

  return (
    <div className="px-4 pt-6 sm:px-6">
      {/* header row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-terracotta"><SlidersHorizontal size={12} /> The feed</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary-deep sm:text-3xl">My campus board</h1>
          <p className="mt-0.5 text-[11px] font-medium text-ink-soft">{counts.active} active · {counts.today} today · {counts.overdue} overdue · {savedIds.length} saved</p>
        </div>
        <div className="flex rounded-full border border-line bg-card p-1 card-shadow-sm" role="group" aria-label="View mode">
          <button onClick={() => setView('board')} aria-pressed={view === 'board'} title="Grouped board" className={`rounded-full p-2 transition ${view === 'board' ? 'bg-primary text-[#FAF4E9]' : 'text-ink-soft hover:text-primary'}`}><LayoutGrid size={16} /></button>
          <button onClick={() => setView('list')} aria-pressed={view === 'list'} title="Flat list" className={`rounded-full p-2 transition ${view === 'list' ? 'bg-primary text-[#FAF4E9]' : 'text-ink-soft hover:text-primary'}`}><List size={16} /></button>
        </div>
      </div>

      {/* attention banner */}
      {counts.today + counts.overdue > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-400/70 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-100 px-4 py-2.5 card-shadow-sm">
          <Flame size={20} className="shrink-0 text-terracotta" strokeWidth={2.2} />
          <p className="text-[12px] leading-snug text-amber-950">
            <strong className="font-display font-bold">Heads up:</strong>{' '}
            {counts.overdue > 0 && <><strong>{counts.overdue} overdue</strong> deadline{counts.overdue > 1 ? 's' : ''} · </>}
            <strong>{counts.today}</strong> item{counts.today === 1 ? '' : 's'} due today. Clear them before they bury you.
          </p>
        </div>
      )}

      {/* search + filter bar */}
      <div className="sticky top-[52px] z-20 -mx-4 border-b border-line/70 bg-paper/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 md:top-[56px]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line-strong bg-card px-3 py-2 card-shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <Search size={16} className="shrink-0 text-ink-faint" />
              <input
                value={filters.query}
                onChange={(e) => setFilters({ query: e.target.value })}
                placeholder="Search title, venue, action items…"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
                aria-label="Search notices"
              />
              {filters.query && <button onClick={() => setFilters({ query: '' })} aria-label="Clear search"><X size={15} className="text-ink-faint hover:text-ink" /></button>}
            </label>
            <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })} className="field w-auto !py-2 text-[12px]" aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="today">Today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
              <option value="undated">Date TBD</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="postponed">Postponed</option>
            </select>
            <select value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value as typeof filters.priority })} className="field w-auto !py-2 text-[12px]" aria-label="Filter by priority">
              <option value="all">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
            <button
              onClick={() => setSavedOnly(!savedOnly)}
              aria-pressed={savedOnly}
              title="Show bookmarked only"
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[11.5px] font-semibold transition ${savedOnly ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-line bg-card text-ink-soft hover:text-primary'}`}
            >
              <Star size={14} className={savedOnly ? 'fill-amber-400 text-amber-500' : ''} /> Saved
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-2xl border border-line bg-card px-3 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:text-primary">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[#0E4C38]" checked={filters.showDone} onChange={(e) => setFilters({ showDone: e.target.checked })} />
              Show done
            </label>
            {hasActiveFilter && (
              <button onClick={() => { resetFilters(); setSavedOnly(false); }} className="flex items-center gap-1 rounded-2xl px-2.5 py-2 text-[11px] font-bold text-terracotta hover:bg-terracotta-soft">
                <Eraser size={13} /> Reset
              </button>
            )}
          </div>
          {/* category tokens */}
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const Icon = meta.icon;
              const active = filters.categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-display text-[10.5px] font-semibold transition-all duration-150 ${
                    active ? 'border-primary bg-primary text-[#FAF4E9] shadow-sm' : 'border-line-strong bg-card text-ink-soft hover:border-primary hover:text-primary'
                  }`}
                >
                  <Icon size={12} strokeWidth={2.3} />{c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* results */}
      {filtered.length === 0 ? (
        <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center">
          <svg width="92" height="92" viewBox="0 0 92 92" fill="none" aria-hidden>
            <circle cx="40" cy="40" r="22" stroke="#0E4C38" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M57 57l16 16" stroke="#0E4C38" strokeWidth="4" strokeLinecap="round" />
            <path d="M32 40h16" stroke="#F0A500" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <p className="mt-4 font-display text-lg font-bold text-ink">Nothing matches that</p>
          <p className="mt-1 text-[12px] text-ink-soft">Try a different word, clear the category chips, or widen the status filter.</p>
          <button onClick={() => { resetFilters(); setSavedOnly(false); }} className="btn-ghost mt-4 !py-2 text-xs"><Eraser size={13} /> Clear all filters</button>
        </div>
      ) : view === 'list' ? (
        <div className="mt-4 grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
          </AnimatePresence>
        </div>
      ) : (
        <div className="mt-4 space-y-6 pb-6">
          <Section title="Today" subtitle="clear these first" tone="today" items={todays} icon={<Flame size={13} />} />
          <Section title="Overdue" subtitle="deadlines you slipped past" tone="overdue" items={overdue} icon={<Flame size={13} />} />
          <Section title="Upcoming" subtitle="the week and beyond" tone="upcoming" items={upcoming} icon={<CalendarClock size={13} />} />
          <Section title="Expired & resolved" subtitle="past, cancelled or postponed — kept for your records" tone="expired" items={past} icon={<Archive size={13} />} />
        </div>
      )}
    </div>
  );
}

function Section({
  title, subtitle, tone, items, icon,
}: {
  title: string;
  subtitle: string;
  tone: 'today' | 'overdue' | 'upcoming' | 'expired';
  items: CampusItem[];
  icon: ReactNode;
}) {
  if (items.length === 0) return null;
  const toneCls =
    tone === 'today' ? 'text-amber-900 border-amber-300 bg-amber-100/80'
    : tone === 'overdue' ? 'text-red-900 border-red-300 bg-red-100/80'
    : tone === 'upcoming' ? 'text-emerald-900 border-emerald-300 bg-emerald-100/70'
    : 'text-stone-600 border-stone-300 bg-stone-100/80';
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[10.5px] font-bold uppercase tracking-[0.18em] ${toneCls}`}>
          {icon}{title}
          <span className="ml-0.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px]">{items.length}</span>
        </span>
        <span className="text-[10px] font-medium text-ink-faint">{subtitle}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => <ItemCard key={item.id} item={item} />)}
        </AnimatePresence>
      </div>
    </section>
  );
}
