import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CampusItem, Category, Priority, ItemStatus } from './types';
import { diffDaysFromToday, todayISO, endOfWeekISO, nowMinutes, timeToMinutes } from './dates';
import { buildSeedItems } from './seedFeed';
import { noticeFingerprint } from './nlp';

export type { ItemStatus };
export type SortKey = 'smart' | 'date' | 'priority' | 'category';

export interface Filters {
  query: string;
  categories: Category[];
  priority: Priority | 'all';
  status: 'all' | ItemStatus;
  showDone: boolean;
}

const ITEMS_KEY = 'campuspulse.items.v2';
const SAVED_IDS_KEY = 'campuspulse.saved.v1';
const SAVED_RAW_KEY = 'campuspulse.savedRaw.v1';
export const API_KEY_KEY = 'campuspulse.openaiKey.v1';

export interface SavedRawNotice {
  id: string;
  text: string;
  savedAt: string;
  label?: string;
}

interface StoreContextValue {
  items: CampusItem[];
  addItem: (item: CampusItem) => { ok: boolean; reason?: 'duplicate' };
  updateItem: (id: string, patch: Partial<CampusItem>) => void;
  removeItem: (id: string) => void;
  toggleDone: (id: string) => void;
  toggleAction: (id: string, index: number) => void;
  clearAll: () => void;
  restoreSeeds: () => void;
  isSaved: (id: string) => boolean;
  savedIds: string[];
  toggleSave: (id: string) => void;
  savedRaws: SavedRawNotice[];
  saveRaw: (text: string, label?: string) => void;
  removeSavedRaw: (id: string) => void;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  statusOf: (item: CampusItem) => ItemStatus;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  filtered: CampusItem[];
  savedOnly: boolean;
  setSavedOnly: (v: boolean) => void;
  counts: { today: number; overdue: number; week: number; critical: number; active: number; total: number };
}

const StoreContext = createContext<StoreContextValue | null>(null);

const defaultFilters: Filters = {
  query: '',
  categories: [],
  priority: 'all',
  status: 'all',
  showDone: false,
};

const PRIORITY_WEIGHT: Record<Priority, number> = { critical: 0, high: 1, normal: 2 };

/* ---------- status: time-aware, lifecycle-aware ---------- */

export function statusOfItem(item: CampusItem): ItemStatus {
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'postponed') return 'postponed';
  if (item.done) return 'expired';
  if (!item.date) return 'undated';
  const d = diffDaysFromToday(item.date);
  if (d > 0) return 'upcoming';
  // today's item is "today" until its time passes (if a time is known)
  if (d === 0) {
    const t = timeToMinutes(item.time);
    if (t !== null && t <= nowMinutes()) {
      // past-today: deadlines have fully passed, events may still be meaningful → treat as expired
      return 'expired';
    }
    return 'today';
  }
  return item.kind === 'deadline' ? 'overdue' : 'expired';
}

/* ---------- storage with validation ---------- */

const isValidCategory = (c: unknown): c is Category =>
  typeof c === 'string' && ['Academic', 'Exam', 'Event', 'Placement', 'Fee', 'Sports', 'Hackathon', 'General'].includes(c);
const isValidPriority = (p: unknown): p is Priority =>
  typeof p === 'string' && ['critical', 'high', 'normal'].includes(p);
const isValidKind = (k: unknown): k is CampusItem['kind'] => k === 'event' || k === 'deadline';

function sanitizeItem(raw: unknown): CampusItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== 'string' || r.title.trim().length === 0) return null;
  if (typeof r.id !== 'string' || !r.id) return null;
  const item: CampusItem = {
    id: r.id.slice(0, 120),
    title: r.title.slice(0, 200),
    date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
    time: typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : null,
    endTime: typeof r.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.endTime) ? r.endTime : null,
    venue: typeof r.venue === 'string' ? r.venue.slice(0, 120) : null,
    category: isValidCategory(r.category) ? r.category : 'General',
    priority: isValidPriority(r.priority) ? r.priority : 'normal',
    kind: isValidKind(r.kind) ? r.kind : 'event',
    summary: typeof r.summary === 'string' ? r.summary.slice(0, 600) : '',
    actionItems: Array.isArray(r.actionItems)
      ? r.actionItems.filter((a): a is string => typeof a === 'string').slice(0, 8)
      : [],
    actionDeadline: typeof r.actionDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.actionDeadline) ? r.actionDeadline : null,
    checkedActions: Array.isArray(r.checkedActions)
      ? r.checkedActions.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 16)
      : [],
    done: r.done === true,
    status: r.status === 'cancelled' || r.status === 'postponed' ? r.status : undefined,
    source: r.source === 'seed' || r.source === 'analyzed' || r.source === 'manual' ? r.source : 'analyzed',
    engine: r.engine === 'llm' || r.engine === 'heuristic' || r.engine === 'seed' ? r.engine : 'heuristic',
    rawText: typeof r.rawText === 'string' ? r.rawText.slice(0, 8000) : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
  };
  return item;
}

const readStorage = <T,>(key: string, fallback: T, validate: (v: unknown) => T | null): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const validated = validate(parsed);
    return validated ?? fallback;
  } catch {
    return fallback;
  }
};

const loadItems = (): CampusItem[] => {
  let items: CampusItem[] = [];
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed.map(sanitizeItem).filter((i): i is CampusItem => i !== null);
    } else {
      // migrate v1 → v2
      const legacy = localStorage.getItem('campuspulse.items.v1');
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        if (Array.isArray(parsed)) items = parsed.map(sanitizeItem).filter((i): i is CampusItem => i !== null);
        try { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); localStorage.removeItem('campuspulse.items.v1'); } catch { /* quota */ }
      } else {
        items = buildSeedItems();
      }
    }
  } catch {
    items = buildSeedItems();
  }
  return items;
};

const loadStringArray = (key: string): string[] =>
  readStorage(key, [], (v) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null));

const loadSavedRaws = (): SavedRawNotice[] =>
  readStorage(SAVED_RAW_KEY, [], (v) => {
    if (!Array.isArray(v)) return null;
    const out: SavedRawNotice[] = [];
    for (const r of v) {
      if (typeof r === 'object' && r !== null) {
        const rr = r as Record<string, unknown>;
        if (typeof rr.id === 'string' && typeof rr.text === 'string' && typeof rr.savedAt === 'string') {
          out.push({ id: rr.id.slice(0, 80), text: rr.text.slice(0, 8000), savedAt: rr.savedAt, label: typeof rr.label === 'string' ? rr.label.slice(0, 80) : undefined });
        }
      }
    }
    return out;
  });

const loadApiKey = (): string | null => {
  // modern format: JSON-encoded string
  const json = readStorage(API_KEY_KEY, null as string | null, (v) => (typeof v === 'string' && v.trim().length >= 10 ? v : null));
  if (json) return json.trim();
  // legacy format: plain (non-JSON) string value
  try {
    const raw = localStorage.getItem(API_KEY_KEY);
    if (!raw) return null;
    const trimmed = raw.trim().replace(/^"|"$/g, '');
    return trimmed.length >= 10 && trimmed.length <= 260 && /^[A-Za-z0-9_\-.]+$/.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
};

export const ENV_API_KEY = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_OPENAI_API_KEY ?? '').trim() || null;

/** Weekly boundary: today (inclusive) through the coming Sunday (inclusive). */
const currentWeekEnd = (): string => endOfWeekISO(todayISO());

/** Re-render trigger: bump on visibility/focus/midnight */
const useTodayTick = (): string => {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const recompute = () => setToday((prev) => {
      const now = todayISO();
      return now !== prev ? now : prev;
    });
    const onVisible = () => { if (document.visibilityState === 'visible') recompute(); };
    window.addEventListener('focus', recompute);
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(recompute, 60_000);
    return () => {
      window.removeEventListener('focus', recompute);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(t);
    };
  }, []);
  return today;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useTodayTick();
  const [items, setItems] = useState<CampusItem[]>(loadItems);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadStringArray(SAVED_IDS_KEY));
  const [savedRaws, setSavedRaws] = useState<SavedRawNotice[]>(loadSavedRaws);
  const [apiKey, setApiKey] = useState<string | null>(loadApiKey);
  const [filters, setFiltersState] = useState<Filters>(defaultFilters);
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); } catch { /* quota */ }
  }, [items]);
  useEffect(() => {
    try { localStorage.setItem(SAVED_IDS_KEY, JSON.stringify(savedIds)); } catch { /* quota */ }
  }, [savedIds]);
  useEffect(() => {
    try { localStorage.setItem(SAVED_RAW_KEY, JSON.stringify(savedRaws)); } catch { /* quota */ }
  }, [savedRaws]);
  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem(API_KEY_KEY, JSON.stringify(apiKey));
      else localStorage.removeItem(API_KEY_KEY);
    } catch { /* quota */ }
  }, [apiKey]);

  const addItem = useCallback((item: CampusItem): { ok: boolean; reason?: 'duplicate' } => {
    let result: { ok: boolean; reason?: 'duplicate' } = { ok: true };
    setItems((prev) => {
      const fp = noticeFingerprint(item);
      const dup = prev.find((p) => noticeFingerprint(p) === fp && p.source !== 'seed');
      if (dup) {
        result = { ok: false, reason: 'duplicate' };
        return prev;
      }
      return [item, ...prev];
    });
    return result;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<CampusItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSavedIds((prev) => prev.filter((s) => s !== id));
  }, []);

  const toggleDone = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }, []);

  const toggleAction = useCallback((id: string, index: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const set = new Set(it.checkedActions);
        if (set.has(index)) set.delete(index);
        else set.add(index);
        return { ...it, checkedActions: [...set] };
      }),
    );
  }, []);

  const clearAll = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm('Clear every notice from your board? This cannot be undone.')) {
      setItems([]);
      setSavedIds([]);
    }
  }, []);

  const restoreSeeds = useCallback(() => {
    setItems(buildSeedItems());
    setSavedIds([]);
  }, []);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);
  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  const saveRaw = useCallback((text: string, label?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSavedRaws((prev) => {
      // de-dupe identical raw clips
      if (prev.some((r) => r.text === trimmed)) return prev;
      return [
        { id: `raw-${Date.now().toString(36)}`, text: trimmed, savedAt: new Date().toISOString(), label },
        ...prev,
      ];
    });
  }, []);
  const removeSavedRaw = useCallback((id: string) => {
    setSavedRaws((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const statusOf = useCallback((item: CampusItem) => statusOfItem(item), []);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);
  const resetFilters = useCallback(() => setFiltersState(defaultFilters), []);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = items.filter((it) => {
      if (savedOnly && !savedIds.includes(it.id)) return false;
      if (!filters.showDone && it.done) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(it.category)) return false;
      if (filters.priority !== 'all' && it.priority !== filters.priority) return false;
      if (filters.status !== 'all' && statusOfItem(it) !== filters.status) return false;
      if (q) {
        const haystack = [
          it.title, it.summary, it.venue ?? '', it.category, it.kind,
          ...(it.actionItems ?? []), it.rawText ?? '',
        ].join(' ').toLowerCase();
        if (!q.split(/\s+/).every((w) => haystack.includes(w))) return false;
      }
      return true;
    });
    const statusRank = (s: ItemStatus) =>
      s === 'cancelled' ? 4 : s === 'postponed' ? 3 : s === 'overdue' ? 0 : s === 'today' ? 1 : s === 'upcoming' ? 2 : 3;
    return [...list].sort((a, b) => {
      const sa = statusOfItem(a), sb = statusOfItem(b);
      if (statusRank(sa) !== statusRank(sb)) return statusRank(sa) - statusRank(sb);
      const pa = PRIORITY_WEIGHT[a.priority], pb = PRIORITY_WEIGHT[b.priority];
      if (pa !== pb) return pa - pb;
      if (a.date && b.date) return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters, savedOnly, savedIds, today]);

  const counts = useMemo(() => {
    const todayISODate = today;
    const weekEnd = currentWeekEnd();
    const live = items.filter((i) => !i.done && i.status !== 'cancelled');
    const todayCount = live.filter((i) => statusOfItem(i) === 'today').length;
    const overdue = live.filter((i) => statusOfItem(i) === 'overdue').length;
    const week = live.filter((i) => i.date && i.date >= todayISODate && i.date <= weekEnd).length;
    const critical = live.filter((i) => i.priority === 'critical').length;
    const active = items.filter((i) => !i.done).length;
    return { today: todayCount, overdue, week, critical, active, total: items.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, today]);

  const value: StoreContextValue = {
    items, addItem, updateItem, removeItem, toggleDone, toggleAction, clearAll, restoreSeeds,
    isSaved, savedIds, toggleSave, savedRaws, saveRaw, removeSavedRaw,
    apiKey, setApiKey,
    statusOf, filters, setFilters, resetFilters, filtered, savedOnly, setSavedOnly, counts,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

