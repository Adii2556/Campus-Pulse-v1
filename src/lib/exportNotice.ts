import type { CampusItem } from './types';
import { formatFull, formatTime } from './dates';

/** Plain-text export of a notice (for share / copy). */
export const exportNotice = (item: CampusItem): string => {
  const lines = [
    `Campus Pulse — ${item.title}`,
    item.date ? `When: ${formatFull(item.date)}${item.time ? `, ${formatTime(item.time)}` : ''}${item.endTime ? `–${formatTime(item.endTime)}` : ''}` : null,
    item.venue ? `Where: ${item.venue}` : null,
    `Category: ${item.category} · ${item.priority === 'critical' ? 'URGENT' : item.priority === 'high' ? 'High priority' : 'Normal priority'} · ${item.kind === 'deadline' ? 'Deadline' : 'Event'}`,
    '',
    item.summary,
  ].filter((l): l is string => l !== null);
  if (item.actionItems.length) {
    lines.push('', 'Action items:');
    item.actionItems.forEach((a) => lines.push(`• ${a}`));
  }
  lines.push('', '— via Campus Pulse');
  return lines.join('\n');
};
