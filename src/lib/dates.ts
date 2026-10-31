/** Date helpers — all local-time, ISO (yyyy-mm-dd) based. */

export const todayISO = (): string => toISO(new Date());

export const toISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const fromISO = (iso: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(NaN);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // reject overflow (e.g. 2026-02-31 rolled into March)
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return new Date(NaN);
  }
  return d;
};

export const isValidISODate = (iso: unknown): iso is string =>
  typeof iso === 'string' && !Number.isNaN(fromISO(iso).getTime());

export const addDays = (iso: string, n: number): string => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const offsetFromToday = (n: number): string => addDays(todayISO(), n);

/** signed days from today to iso: negative = past (NaN-safe → 0) */
export const diffDaysFromToday = (iso: string): number => {
  const a = fromISO(todayISO());
  const b = fromISO(iso);
  if (Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/** End of the current week-start/end convention: Monday-based ISO week, through Sunday. */
export const endOfWeekISO = (from: string = todayISO()): string => {
  const d = fromISO(from);
  // days until Sunday (getDay: 0=Sun … 6=Sat); week runs Mon..Sun
  const untilSunday = (7 - d.getDay()) % 7;
  return addDays(from, untilSunday);
};

/** "This week" = today → upcoming Sunday. Consistent with calendar week view. */
export const weekRange = (from: string = todayISO()): { start: string; end: string } => ({
  start: from,
  end: endOfWeekISO(from),
});

export const isTimeValid = (t: unknown): t is string =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export const formatFriendly = (iso: string | null): string => {
  if (!iso || !isValidISODate(iso)) return 'Date to be announced';
  return fromISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const formatFull = (iso: string | null): string => {
  if (!iso || !isValidISODate(iso)) return 'Date to be announced';
  return fromISO(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTime = (t: string | null): string => {
  if (!t || !isTimeValid(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const relLabel = (iso: string | null): string => {
  if (!iso || !isValidISODate(iso)) return '';
  const d = diffDaysFromToday(iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1) return `in ${d} days`;
  return `${-d} days ago`;
};

/** ordinal day label used inside raw-text templates, e.g. "3 Nov" */
export const dayMonth = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const weekdayShort = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-IN', { weekday: 'short' });

export const weekdayFull = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-IN', { weekday: 'long' });

export const monthYearLabel = (d: Date): string =>
  d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export const startOfMonthGrid = (view: Date): (Date | null)[] => {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

/** Minutes since midnight; invalid → null. */
export const timeToMinutes = (t: string | null | undefined): number | null => {
  if (!t || !isTimeValid(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Current local minutes since midnight. Injectable for tests. */
export const nowMinutes = (): number => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/* ---------------- calendar exports ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const stampLocal = (iso: string, time: string | null): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!time) return `${y}${pad(m)}${pad(d)}`;
  const [hh, mm] = time.split(':').map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
};

const addHoursISO = (iso: string, time: string, hours: number): { iso: string; time: string } => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const dayOffset = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  return { iso: addDays(iso, dayOffset), time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` };
};

const escapeIcsText = (s: string): string =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Fold a content line to 75 octets per RFC 5545 §3.1 (approximation at char level). */
const foldIcsLine = (line: string): string => {
  const MAX = 73;
  if (line.length <= MAX) return line;
  const parts: string[] = [line.slice(0, MAX)];
  let rest = line.slice(MAX);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, MAX - 1));
    rest = rest.slice(MAX - 1);
  }
  return parts.join('\r\n');
};

const icsDateStampUTC = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const googleCalUrl = (item: {
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  venue: string | null;
  summary: string;
  actionItems: string[];
}): string | null => {
  if (!item.date || !isValidISODate(item.date)) return null;
  const start = stampLocal(item.date, item.time);
  let end: string;
  if (item.time) {
    if (item.endTime && isTimeValid(item.endTime) && item.endTime > item.time) {
      end = stampLocal(item.date, item.endTime);
    } else {
      const plus = addHoursISO(item.date, item.time, 1);
      end = stampLocal(plus.iso, plus.time);
    }
  } else {
    end = stampLocal(addDays(item.date, 1), null);
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${start}/${end}`,
    details: `${item.summary}${item.actionItems.length ? '\n\nAction items:\n' + item.actionItems.map((a) => '• ' + a).join('\n') : ''}\n\n— via Campus Pulse`,
    location: item.venue ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildIcs = (item: {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  venue: string | null;
  summary: string;
  actionItems: string[];
}): string | null => {
  if (!item.date || !isValidISODate(item.date)) return null;
  const start = stampLocal(item.date, item.time);
  let end: string;
  if (item.time) {
    if (item.endTime && isTimeValid(item.endTime) && item.endTime > item.time) {
      end = stampLocal(item.date, item.endTime);
    } else {
      const plus = addHoursISO(item.date, item.time, 1);
      end = stampLocal(plus.iso, plus.time);
    }
  } else {
    end = stampLocal(addDays(item.date, 1), null);
  }
  const desc = `${item.summary}${item.actionItems.length ? '\nAction items:\n' + item.actionItems.map((a) => '- ' + a).join('\n') : ''}`;
  const rawLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus Pulse//Notice Intelligence//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(item.id)}@campuspulse`,
    `DTSTAMP:${icsDateStampUTC(new Date())}`,
    item.time ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${start}`,
    item.time ? `DTEND:${end}` : `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(item.title.replace(/\s+/g, ' ').trim())}`,
    item.venue ? `LOCATION:${escapeIcsText(item.venue.replace(/\s+/g, ' ').trim())}` : '',
    `DESCRIPTION:${escapeIcsText(desc)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return rawLines.map(foldIcsLine).join('\r\n');
};
