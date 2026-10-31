import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, CalendarDays, CheckCircle2, Circle, Trash2, Star, Check,
  ChevronDown, ChevronUp, Download, Share2, FileText, ListChecks, X, CheckCheck, CalendarClock,
} from 'lucide-react';
import type { CampusItem, Category, Priority, ItemKind } from '../lib/types';
import { CATEGORIES } from '../lib/types';
import { useStore, statusOfItem } from '../lib/store';
import { useToast } from './Toast';
import { CATEGORY_META } from '../lib/meta';
import { CategoryChip, PriorityChip, StatusChip, LifecycleChip, CriticalStamp } from './chips';
import { formatFull, formatTime, relLabel, googleCalUrl, buildIcs } from '../lib/dates';
import { exportNotice } from '../lib/exportNotice';

interface Draft {
  title: string;
  date: string;
  time: string;
  endTime: string;
  venue: string;
  category: Category;
  priority: Priority;
  kind: ItemKind;
  summary: string;
}
const toDraft = (item: CampusItem): Draft => ({
  title: item.title,
  date: item.date ?? '',
  time: item.time ?? '',
  endTime: item.endTime ?? '',
  venue: item.venue ?? '',
  category: item.category,
  priority: item.priority,
  kind: item.kind,
  summary: item.summary,
});

export default function ItemCard({ item, initialExpanded = false }: { item: CampusItem; initialExpanded?: boolean }) {
  const { toggleDone, toggleAction, removeItem, isSaved, toggleSave, updateItem } = useStore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));

  const status = statusOfItem(item);
  const lifecycle = item.status;
  const done = item.done;
  const isToday = status === 'today';
  const checkedCount = item.checkedActions.length;
  const totalActions = item.actionItems.length;
  const isCritical = item.priority === 'critical' && !done && lifecycle !== 'cancelled';

  useEffect(() => {
    if (!editing) setDraft(toDraft(item));
  }, [item, editing]);

  const saveEdit = () => {
    updateItem(item.id, {
      title: draft.title.trim() || item.title,
      date: draft.date || null,
      time: draft.time || null,
      endTime: draft.endTime || null,
      venue: draft.venue.trim() || null,
      category: draft.category,
      priority: draft.priority,
      kind: draft.kind,
      summary: draft.summary.trim() || item.summary,
    });
    setEditing(false);
    toast('Notice updated');
  };

  const downloadIcs = () => {
    const ics = buildIcs(item);
    if (!ics) return toast('Add a date first to export');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.slice(0, 40).replace(/[^\w]+/g, '-').toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Calendar file downloaded');
  };

  const share = async () => {
    const text = exportNotice(item);
    try {
      if (navigator.share) await navigator.share({ title: item.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard');
      } catch {
        toast('Could not share on this device');
      }
    }
  };

  const gcal = googleCalUrl(item);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card card-shadow-sm transition-shadow duration-300 hover:card-shadow ${
        isToday && !done ? 'border-amber-400 ring-2 ring-amber-300/60' : 'border-line'
      } ${done ? 'opacity-70 saturate-50' : ''}`}
    >
      {/* urgency strip — color = category, red-tinted when critical */}
      <div className="h-1.5 w-full" style={{ background: done || lifecycle === 'cancelled' ? '#D6D3CB' : isCritical ? '#DC2626' : CATEGORY_META[item.category].dot }} aria-hidden />

      {isCritical && <CriticalStamp />}

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        {/* top row: chips + actions */}
        <div className="flex flex-wrap items-center gap-1.5 pr-14">
          <CategoryChip category={item.category} />
          <PriorityChip priority={item.priority} />
          {lifecycle ? <LifecycleChip kind={lifecycle} /> : <StatusChip status={status} />}
          <span className="chip border border-line bg-paper text-ink-soft">{item.kind === 'deadline' ? 'Deadline' : 'Event'}</span>
          {item.engine === 'llm' && <span className="chip border border-violet-200 bg-violet-50 text-violet-800" title="Extracted with AI (your key)">AI</span>}
          {item.engine === 'heuristic' && <span className="chip border border-line bg-paper text-ink-soft" title="Extracted on-device, offline">On-device</span>}
          {item.source === 'seed' && <span className="chip border border-dashed border-line-strong bg-paper text-ink-faint" title="Sample data so the board isn't empty on first launch — replace it with your own">Demo</span>}
        </div>

        {/* title + done toggle */}
        <div className="flex items-start gap-2.5">
          <button
            onClick={() => toggleDone(item.id)}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            title={done ? 'Mark as not done' : 'Mark as done'}
            className="mt-0.5 shrink-0 text-primary transition hover:scale-110"
          >
            {done ? <CheckCircle2 size={22} className="text-emerald-700" /> : <Circle size={22} strokeWidth={1.6} />}
          </button>
          <div className="min-w-0 flex-1">
            {editing ? (
              <input className="field font-display text-base font-semibold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
            ) : (
              <h3 className={`font-display text-[1.06rem] font-semibold leading-snug text-ink ${done ? 'line-through decoration-ink-faint/60' : ''}`}>
                {item.title}
              </h3>
            )}
          </div>
          <button
            onClick={() => toggleSave(item.id)}
            aria-label={isSaved(item.id) ? 'Remove bookmark' : 'Bookmark'}
            title={isSaved(item.id) ? 'Remove bookmark' : 'Bookmark'}
            className="shrink-0 rounded-full p-1.5 text-ink-soft transition hover:bg-accent-soft hover:text-accent-deep"
          >
            <Star size={18} strokeWidth={1.8} className={isSaved(item.id) ? 'fill-amber-400 text-amber-500' : ''} />
          </button>
        </div>

        {/* meta row */}
        {editing ? (
          <div className="grid grid-cols-1 gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Date" />
              <input className="field" placeholder="Action deadline (optional)" value={item.actionDeadline ?? ''} disabled aria-label="Action deadline" title="Captured from the notice; read-only" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="field" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-label="Time" />
              <input type="time" className="field" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} aria-label="End time" />
            </div>
            <input className="field" placeholder="Venue" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} aria-label="Venue" />
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })} aria-label="Category">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="field" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ItemKind })} aria-label="Kind">
                <option value="event">Event</option>
                <option value="deadline">Deadline</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['critical', 'high', 'normal'] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, priority: p })}
                  className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold capitalize transition ${draft.priority === p ? (p === 'critical' ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-400/50' : p === 'high' ? 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400/50' : 'border-stone-400 bg-stone-200 text-stone-800 ring-2 ring-stone-400/40') : 'border-line bg-paper text-ink-soft'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-ink-soft">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CalendarDays size={14} className="text-primary" />
              <span className={isToday ? 'font-bold text-amber-800' : ''}>{formatFull(item.date)}</span>
              {item.date && <span className="text-ink-faint">· {relLabel(item.date)}</span>}
            </span>
            {item.time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-primary" />
                {formatTime(item.time)}{item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
              </span>
            )}
            {item.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" />
                {item.venue}
              </span>
            )}
            {item.actionDeadline && (
              <span className="inline-flex items-center gap-1.5 font-medium text-terracotta" title="Action deadline captured from this notice">
                <CalendarClock size={14} />
                Act by {formatFull(item.actionDeadline)}
              </span>
            )}
          </div>
        )}

        {/* summary */}
        {editing ? (
          <textarea className="field min-h-[72px] resize-y text-sm" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
        ) : (
          <p className="text-[0.85rem] leading-relaxed text-ink-soft">{item.summary}</p>
        )}

        {/* action items */}
        {totalActions > 0 && (
          <div className="rounded-xl border border-line bg-paper/70 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider text-ink-soft">
                <ListChecks size={13} /> Do this
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${checkedCount === totalActions ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                  {checkedCount}/{totalActions}
                </span>
              </span>
              {checkedCount < totalActions && (
                <button
                  onClick={() => item.actionItems.forEach((_, i) => !item.checkedActions.includes(i) && toggleAction(item.id, i))}
                  className="text-[10.5px] font-semibold text-primary hover:underline"
                >
                  Check all
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {item.actionItems.map((action, i) => {
                const checked = item.checkedActions.includes(i);
                return (
                  <li key={i}>
                    <button onClick={() => toggleAction(item.id, i)} className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left transition hover:bg-primary-soft/60">
                      <span className={`mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded border ${checked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-line-strong bg-white'}`}>
                        {checked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className={`text-[0.8rem] leading-snug ${checked ? 'text-ink-faint line-through' : 'text-ink'}`}>{action}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* expanded raw text */}
        <AnimatePresence>
          {expanded && item.rawText && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <pre className="whitespace-pre-wrap rounded-lg border border-dashed border-line-strong bg-[#FBF8EE] p-3 font-mono text-[10.5px] leading-relaxed text-ink-soft">{item.rawText}</pre>
            </motion.div>
          )}
        </AnimatePresence>

        {/* footer actions */}
        <div className="mt-auto flex items-center gap-1 border-t border-line pt-2">
          {editing ? (
            <>
              <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={saveEdit}><Check size={14} /> Save</button>
              <button className="btn-ghost !px-4 !py-1.5 text-xs" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} title="Edit fields" className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:bg-primary-soft hover:text-primary">Edit</button>
              {gcal && <a href={gcal} target="_blank" rel="noreferrer" title="Add to Google Calendar" className="rounded-lg p-1.5 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Add to Google Calendar"><CalendarDays size={16} /></a>}
              <button onClick={downloadIcs} title="Download .ics file" className="rounded-lg p-1.5 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Download calendar file"><Download size={16} /></button>
              <button onClick={share} title="Copy / share summary" className="rounded-lg p-1.5 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Copy summary"><Share2 size={16} /></button>
              {item.rawText && (
                <button onClick={() => setExpanded((v) => !v)} title="View original notice" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:bg-primary-soft hover:text-primary">
                  <FileText size={14} />{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
              <span className="ml-auto" />
              {confirmDelete ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold text-red-800">Delete?</span>
                  <button onClick={() => removeItem(item.id)} className="rounded-lg bg-red-700 p-1.5 text-white hover:bg-red-800" aria-label="Confirm delete"><Check size={14} /></button>
                  <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-line-strong p-1.5 text-ink-soft hover:bg-paper" aria-label="Keep it"><X size={14} /></button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(true)} title="Delete" className="rounded-lg p-1.5 text-ink-faint transition hover:bg-red-50 hover:text-red-700" aria-label="Delete notice">
                  <Trash2 size={16} />
                </button>
              )}
              {!done && status === 'today' && (
                <button onClick={() => toggleDone(item.id)} title="Done — clear from today" className="rounded-lg p-1.5 text-emerald-800 transition hover:bg-emerald-50" aria-label="Mark done">
                  <CheckCheck size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
