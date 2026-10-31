import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORY_META } from '../lib/meta';
import { startOfMonthGrid, monthYearLabel, toISO, todayISO, formatFull, formatTime } from '../lib/dates';
import ItemCard from '../components/ItemCard';
import type { CampusItem } from '../lib/types';

export default function CalendarPage() {
  const { items } = useStore();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(todayISO());

  const cells = useMemo(() => startOfMonthGrid(viewDate), [viewDate]);
  const today = todayISO();

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CampusItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
  }, [items]);

  const goMonth = (delta: number) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  const selectedItems = selected ? itemsByDate.get(selected) ?? [] : [];

  return (
    <div className="px-4 pt-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-terracotta"><CalendarDays size={12} /> Month view</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary-deep sm:text-3xl">{monthYearLabel(viewDate)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(new Date())} className="btn-ghost !px-4 !py-2 text-xs">Today</button>
          <div className="flex rounded-full border border-line bg-card p-1 card-shadow-sm">
            <button onClick={() => goMonth(-1)} className="rounded-full p-2 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Previous month"><ChevronLeft size={17} /></button>
            <button onClick={() => goMonth(1)} className="rounded-full p-2 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Next month"><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* month grid */}
        <div className="overflow-hidden rounded-3xl border border-line bg-card card-shadow lg:col-span-8">
          <div className="grid grid-cols-7 border-b border-line bg-paper/60">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-1 py-2 text-center font-display text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint sm:text-[10.5px]">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="min-h-16 border-b border-r border-line/60 bg-paper/30 last:border-r-0 sm:min-h-24" />;
              const iso = toISO(cell);
              const dayItems = itemsByDate.get(iso) ?? [];
              const isToday = iso === today;
              const isSelected = iso === selected;
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso === selected ? null : iso)}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-16 flex-col items-stretch gap-0.5 border-b border-r border-line/60 p-1 text-left transition sm:min-h-24 sm:p-1.5 ${
                    isSelected ? 'bg-primary-soft ring-2 ring-inset ring-primary' : 'hover:bg-amber-50/60'
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-[11px] font-bold sm:text-[12px] ${
                    isToday ? 'bg-primary text-[#FAF4E9]' : 'text-ink-soft group-hover:text-ink'
                  }`}>
                    {cell.getDate()}
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${item.done ? 'bg-stone-100 text-stone-400 line-through' : 'text-white'}`}
                        style={{ background: item.done ? undefined : CATEGORY_META[item.category].dot }}
                        title={item.title}
                      >
                        {item.time && <span className="shrink-0 opacity-90">{formatTime(item.time)}</span>}
                        <span className="truncate">{item.title}</span>
                      </span>
                    ))}
                    {dayItems.length > 3 && <span className="px-1 text-[8.5px] font-bold text-ink-faint">+{dayItems.length - 3} more</span>}
                  </span>
                  {/* mobile dots */}
                  <span className="flex gap-0.5 px-0.5 sm:hidden">
                    {dayItems.slice(0, 4).map((item) => (
                      <span key={item.id} className="h-1.5 w-1.5 rounded-full" style={{ background: item.done ? '#C9C3B6' : CATEGORY_META[item.category].dot }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {/* legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-paper/60 px-4 py-2">
            {Object.entries(CATEGORY_META).map(([cat, meta]) => (
              <span key={cat} className="flex items-center gap-1 text-[9.5px] font-semibold text-ink-soft">
                <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />{cat}
              </span>
            ))}
          </div>
        </div>

        {/* day detail panel */}
        <aside className="flex flex-col rounded-3xl border border-line bg-card p-4 card-shadow lg:col-span-4">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
            <div>
              <p className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-ink-faint">{selected === today ? 'Today' : 'Selected day'}</p>
              <h2 className="font-display text-lg font-bold text-primary-deep">{selected ? formatFull(selected) : 'Pick a day'}</h2>
            </div>
            {selected && selectedItems.length > 0 && (
              <button className="rounded-full border border-line p-2 text-ink-soft hover:text-ink" onClick={() => setSelected(null)} aria-label="Clear selection"><X size={15} /></button>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {!selected && <p className="mt-8 text-center text-[12px] text-ink-faint">Tap any date on the calendar to see what’s happening.</p>}
            {selected && selectedItems.length === 0 && (
              <div className="mt-8 text-center">
                <p className="font-display text-sm font-bold text-ink-soft">Nothing on this day</p>
                <p className="mt-1 text-[11px] text-ink-faint">Suspiciously free. Go to the Paste studio and check your circulars.</p>
              </div>
            )}
            {selectedItems.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        </aside>
      </div>
    </div>
  );
}
