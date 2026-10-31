import type { CampusItem } from './types';
import { todayISO, weekRange, diffDaysFromToday, formatTime, formatFriendly, fromISO } from './dates';
import { statusOfItem } from './store';

export interface DigestSection {
  icon: 'today' | 'overdue' | 'week' | 'insight';
  heading: string;
  lines: string[];
}

export interface Digest {
  weekOf: string;
  range: string;
  headline: string;
  sections: DigestSection[];
  engine: 'heuristic';
}

const byTime = (a: CampusItem, b: CampusItem) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generateDigest(items: CampusItem[]): Digest {
  const { start, end } = weekRange(todayISO());
  const active = items.filter((i) => !i.done && i.status !== 'cancelled');
  const todayItems = active.filter((i) => i.date === start && statusOfItem(i) === 'today').sort(byTime);
  const overdueItems = active.filter((i) => statusOfItem(i) === 'overdue');
  const upcomingItems = active
    .filter((i) => i.date && i.date > start && i.date <= end)
    .sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')));
  const undated = active.filter((i) => !i.date);

  const sections: DigestSection[] = [];

  sections.push({
    icon: 'today',
    heading: 'Needs attention today',
    lines: todayItems.length
      ? todayItems.map(
          (i) =>
            `${i.time ? formatTime(i.time) + ' — ' : ''}${i.title}${i.venue ? ` · ${i.venue}` : ''}${i.priority === 'critical' ? '  [CRITICAL]' : ''}`,
        )
      : ['Nothing scheduled today. Breathe easy — or get ahead on the week.'],
  });

  if (overdueItems.length) {
    sections.push({
      icon: 'overdue',
      heading: 'Overdue — act on these first',
      lines: overdueItems.map((i) => {
        const days = i.date ? -diffDaysFromToday(i.date) : 0;
        return `${i.title}${i.date ? ` · ${days} day${days === 1 ? '' : 's'} overdue` : ''}${i.actionItems[0] ? ` → ${i.actionItems[0]}` : ''}`;
      }),
    });
  }

  const byDay = new Map<string, CampusItem[]>();
  for (const i of upcomingItems) {
    const list = byDay.get(i.date!) ?? [];
    list.push(i);
    byDay.set(i.date!, list);
  }
  const weekLines: string[] = [];
  for (const [date, list] of byDay) {
    weekLines.push(`${cap(formatFriendly(date))}`);
    for (const i of list.sort(byTime)) {
      weekLines.push(`   • ${i.time ? formatTime(i.time) + ' — ' : ''}${i.title}${i.category ? ` (${i.category})` : ''}`);
    }
  }
  sections.push({
    icon: 'week',
    heading: 'Coming up this week',
    lines: weekLines.length ? weekLines : ['Clear skies — nothing pinned for the rest of this week.'],
  });

  // smart observations
  const insights: string[] = [];
  const criticalWeek = upcomingItems.filter((i) => i.priority === 'critical').length + todayItems.filter((i) => i.priority === 'critical').length;
  if (criticalWeek > 0) insights.push(`${criticalWeek} critical item${criticalWeek > 1 ? 's' : ''} on the calendar — treat them as non-negotiable.`);
  const byCat = new Map<string, number>();
  for (const i of [...todayItems, ...upcomingItems]) byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1);
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 2) insights.push(`${topCat[0]} is dominating the week (${topCat[1]} items) — keep those materials ready.`);
  const deadlineCount = active.filter((i) => i.kind === 'deadline' && i.date && i.date >= start && i.date <= end).length;
  if (deadlineCount >= 3) insights.push(`${deadlineCount} deadlines cluster this week. Block 90 focused minutes a day for them.`);
  const sameDay = [...byDay.values()].find((l) => l.length >= 3);
  if (sameDay) insights.push(`${cap(formatFriendly(sameDay[0].date))} has ${sameDay.length} items — avoid double-booking yourself.`);
  if (undated.length) insights.push(`${undated.length} undated notice${undated.length > 1 ? 's' : ''} pinned — ask the source for dates.`);
  if (!insights.length) insights.push('No red flags this week. A rare campus gift — use the quiet days to get ahead.');
  sections.push({ icon: 'insight', heading: 'Pulse insights', lines: insights });

  const from = fromISO(start);
  const to = fromISO(end);
  const range = `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const headline =
    todayItems.length + overdueItems.length === 0
      ? 'A calm week ahead of you'
      : overdueItems.length > 0
        ? `${overdueItems.length + todayItems.length} thing${overdueItems.length + todayItems.length > 1 ? 's' : ''} need you right now`
        : `${todayItems.length} thing${todayItems.length > 1 ? 's' : ''} on today's plate`;

  return { weekOf: start, range, headline, sections, engine: 'heuristic' };
}
