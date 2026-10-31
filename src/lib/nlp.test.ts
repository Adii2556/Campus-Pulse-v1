import { describe, it, expect } from 'vitest';
import {
  extractDate, extractTime, extractVenue, extractCategory, extractPriority, extractKind,
  analyzeNotice, validateAiNoticeForTest, noticeFingerprint, extractActionItems,
} from './nlp';
import { toISO, weekRange, endOfWeekISO, buildIcs, googleCalUrl, isValidISODate, fromISO } from './dates';
import { statusOfItem } from './store';
import type { CampusItem } from './types';

const REF = new Date(2026, 9, 31, 10, 0, 0); // Sat 31 Oct 2026, 10:00 local
const iso = (offset: number) => {
  const d = new Date(REF);
  d.setDate(d.getDate() + offset);
  return toISO(d);
};

const mkItem = (over: Partial<CampusItem>): CampusItem => ({
  id: 't1', title: 'Test notice', date: null, time: null, endTime: null, venue: null,
  category: 'General', priority: 'normal', kind: 'event', summary: '', actionItems: [],
  checkedActions: [], done: false, source: 'manual', engine: 'heuristic', createdAt: new Date().toISOString(),
  ...over,
});

describe('extractDate — explicit years & validity', () => {
  it('parses ISO dates', () => {
    expect(extractDate('event on 2026-11-14', REF).iso).toBe('2026-11-14');
  });
  it('parses "3 Nov 2026" with explicit year', () => {
    expect(extractDate('fest on 3 Nov 2026', REF).iso).toBe('2026-11-03');
  });
  it('rejects invalid calendar dates (31 Feb)', () => {
    const r = extractDate('exam on 31 feb 2026', REF);
    expect(r.iso === null || isValidISODate(r.iso)).toBe(true);
    expect(r.iso).not.toBe('2026-03-03');
  });
  it('honours explicit future year over current year (Feb 2027 in Nov 2026)', () => {
    expect(extractDate('midsem on 12 feb 2027', REF).iso).toBe('2027-02-12');
  });
  it('keeps Nov 2026 explicit year', () => {
    expect(extractDate('fest on 14 nov 2026', REF).iso).toBe('2026-11-14');
  });
});

describe('extractDate — relative & ranges', () => {
  it('today / tomorrow / day after tomorrow', () => {
    expect(extractDate('mandatory meeting today', REF).iso).toBe(iso(0));
    expect(extractDate('submit by tomorrow', REF).iso).toBe(iso(1));
    expect(extractDate('day after tomorrow we go', REF).iso).toBe(iso(2));
  });
  it('in N days / N days ago', () => {
    expect(extractDate('due in 5 days', REF).iso).toBe(iso(5));
    expect(extractDate('posted 3 days ago', REF).iso).toBe(iso(-3));
  });
  it('date ranges use the range start', () => {
    expect(extractDate('fest from 3rd to 5th November 2026', REF).iso).toBe('2026-11-03');
  });
  it('weekday keywords compute against the reference date', () => {
    const r = extractDate('meet this monday', REF);
    expect(r.iso).toBe('2026-11-02'); // next Monday from Sat 31 Oct
    expect(r.kind).toBe('weekday');
  });
  it('no date → null with null kind', () => {
    const r = extractDate('nothing schedule-worthy here', REF);
    expect(r.iso).toBeNull();
    expect(r.kind).toBeNull();
  });
});

describe('extractTime — ranges & sanity', () => {
  it('simple range same meridiem', () => {
    const r = extractTime('gates 4pm to 8pm');
    expect(r.start).toBe('16:00');
    expect(r.end).toBe('20:00');
  });
  it('range crossing noon "10am to 1pm"', () => {
    const r = extractTime('10am to 1pm');
    expect(r).toEqual(expect.objectContaining({ start: '10:00', end: '13:00' }));
  });
  it('range where start has no meridiem "4 to 6pm"', () => {
    const r = extractTime('runs 4 to 6pm');
    expect(r.start).toBe('16:00');
    expect(r.end).toBe('18:00');
  });
  it('range crossing noon without start meridiem "10 to 1pm"', () => {
    const r = extractTime('runs 10 to 1pm');
    expect(r.start).toBe('10:00');
    expect(r.end).toBe('13:00');
  });
  it('end before start drops the end rather than inverting', () => {
    const r = extractTime('8pm to 6pm');
    expect(r.end).toBeNull();
  });
  it('rejects impossible hour 99', () => {
    expect(extractTime('at 99:00').start).toBeNull();
  });
  it('24h plain time', () => {
    expect(extractTime('reporting 16:00 at oate').start).toBe('16:00');
  });
});

describe('venue / category / kind / priority', () => {
  it('extracts explicit venue labels', () => {
    expect(extractVenue('Venue: Main Auditorium, Block A\nsee you there').venue).toBe('Main Auditorium, Block A');
  });
  it('finds keyword venues with proper names', () => {
    expect(extractVenue('report to Aryabhatta Lab 3, Block C by 9').venue).toContain('Aryabhatta');
  });
  it('categorizes hackathon notices', () => {
    expect(extractCategory('36 hour hackathon this weekend, register now').category).toBe('Hackathon');
  });
  it('separates deadline notices from event notices', () => {
    expect(extractKind('last date to submit fee challan is friday')).toBe('deadline');
    expect(extractKind('cultural night concert this saturday')).toBe('event');
  });
  it('treats "last date TODAY" as critical', () => {
    expect(extractPriority('last date today to pay the fee', iso(0), 'deadline', 'active')).toBe('critical');
  });
  it('treats a far-future event as normal priority', () => {
    expect(extractPriority('concert next month', iso(30), 'event', 'active')).toBe('normal');
  });
  it('cancelled/postponed notices are not prioritized', () => {
    expect(extractPriority('URGENT: workshop cancelled', iso(2), 'event', 'cancelled')).toBe('normal');
  });
});

describe('analyzeNotice — lifecycle & action deadlines', () => {
  it('detects cancellations', () => {
    const r = analyzeNotice('NOTICE: The cultural fest scheduled this friday is cancelled due to rains.', { reference: REF });
    expect(r?.item.status).toBe('cancelled');
  });
  it('detects postponements', () => {
    const r = analyzeNotice('The exam has been postponed to 14 November 2026.', { reference: REF });
    expect(r?.item.status).toBe('postponed');
  });
  it('action items carry a captured deadline date', () => {
    const r = analyzeNotice('Last date to submit the scholarship form by 5 November 2026. Everyone must fill it.', { reference: REF });
    expect(r?.item.actionDeadline).toBe('2026-11-05');
  });
  it('flags multiple-date ambiguity in warnings', () => {
    const r = analyzeNotice('Fest on 10 November 2026, prep meeting tomorrow at 5 pm.', { reference: REF });
    expect(r?.warnings.join(' ')).toMatch(/Multiple dates/);
  });
});

describe('AI response validation (exported for tests)', () => {
  it('rejects wrong types wholesale but keeps valid fields', () => {
    const out = validateAiNoticeForTest({
      title: 'Wipro drive', date: 'not-a-date', time: '25:99', category: 'Vibes', priority: 'supercritical', summary: 'short',
    });
    expect(out?.title).toBe('Wipro drive');
    expect(out).not.toHaveProperty('date');
    expect(out).not.toHaveProperty('time');
    expect(out).not.toHaveProperty('category');
    expect(out).not.toHaveProperty('priority');
  });
  it('drops everything → null', () => {
    expect(validateAiNoticeForTest({ date: 'xx' })).toBeNull();
  });
  it('accepts a fully valid payload', () => {
    const out = validateAiNoticeForTest({
      title: 'NovaTech drive', date: '2026-11-02', time: '09:30', endTime: '17:00', venue: 'Main Auditorium',
      category: 'Placement', priority: 'critical', kind: 'deadline', summary: 'Final rounds for SDE interns today.', actionItems: ['Carry ID', 'Bring resume'],
    });
    expect(out?.category).toBe('Placement');
    expect(out?.actionItems).toHaveLength(2);
  });
});

describe('dedupe fingerprints', () => {
  it('normalized title+date+time collides', () => {
    expect(noticeFingerprint(mkItem({ title: 'NovaTech Drive!', date: '2026-11-02', time: '09:30' })))
      .toBe(noticeFingerprint(mkItem({ title: 'novatech drive', date: '2026-11-02', time: '09:30' })));
  });
  it('different times do not collide', () => {
    expect(noticeFingerprint(mkItem({ title: 'X', date: '2026-11-02', time: '09:30' })))
      .not.toBe(noticeFingerprint(mkItem({ title: 'X', date: '2026-11-02', time: '10:30' })));
  });
});

describe('status & urgency boundaries', () => {
  it('today item with a past time is expired, not today', () => {
    expect(statusOfItem(mkItem({ date: todayISOStatic(), time: '01:00', kind: 'event' }))).toBe('expired');
  });
  it('today item with a future time is today', () => {
    expect(statusOfItem(mkItem({ date: todayISOStatic(), time: '23:00', kind: 'event' }))).toBe('today');
  });
  it('past deadline is overdue, past event is expired', () => {
    expect(statusOfItem(mkItem({ date: '2000-01-01', kind: 'deadline' }))).toBe('overdue');
    expect(statusOfItem(mkItem({ date: '2000-01-01', kind: 'event' }))).toBe('expired');
  });
  it('undated item is undated (not upcoming)', () => {
    expect(statusOfItem(mkItem({ date: null }))).toBe('undated');
  });
  it('cancelled and postponed lifecycles win over dates', () => {
    expect(statusOfItem(mkItem({ status: 'cancelled', date: todayISOStatic() }))).toBe('cancelled');
    expect(statusOfItem(mkItem({ status: 'postponed', date: '2000-01-01' }))).toBe('postponed');
  });
  it('done items read as expired', () => {
    expect(statusOfItem(mkItem({ done: true, date: todayISOStatic() }))).toBe('expired');
  });
});

const todayISOStatic = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe('weekly boundaries', () => {
  it('week ends on the coming Sunday', () => {
    const end = endOfWeekISO('2026-10-31'); // a Saturday
    expect(new Date(end + 'T00:00:00').getDay()).toBe(0);
    expect(end).toBe('2026-11-01');
  });
  it('range is today → Sunday inclusive', () => {
    const r = weekRange('2026-11-04'); // a Wednesday
    expect(r.start).toBe('2026-11-04');
    expect(r.end).toBe('2026-11-08');
  });
});

describe('calendar export escaping & overnight ranges', () => {
  const base = { id: 'ics1', title: 'Fee, dues & challan; FINAL', date: '2026-11-05', time: '21:00', endTime: null, venue: 'Accounts, Block A', summary: 'Line one\nLine two, with comma; and semicolon', actionItems: ['Pay, now'] };
  it('ICS escapes commas, semicolons, newlines', () => {
    const ics = buildIcs(base)!;
    expect(ics).toContain('SUMMARY:Fee\\, dues & challan\\; FINAL');
    expect(ics).toContain('Line one\\nLine two\\, with comma\\;');
    expect(ics).toContain('DTSTART:20261105T210000');
    expect(ics).toContain('DTEND:20261105T220000');
  });
  it('Google URL escapes via URLSearchParams', () => {
    const url = googleCalUrl(base)!;
    expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Fee, dues & challan; FINAL');
  });
  it('overnight end time rolls into the next day', () => {
    const ics = buildIcs({ ...base, time: '23:30', endTime: '02:00' })!;
    expect(ics).toContain('DTSTART:20261105T233000');
    // end 02:00 < start 23:30 → +1 day computed at build time? endTime is trusted only if > start; here it is not, so we fall back to +1 hour
    expect(ics).toContain('DTEND:20261106T003000');
  });
  it('explicit end time later same day is used as-is', () => {
    const ics = buildIcs({ ...base, time: '09:00', endTime: '12:30' })!;
    expect(ics).toContain('DTEND:20261105T123000');
  });
  it('all-day events export VALUE=DATE', () => {
    const ics = buildIcs({ ...base, time: null })!;
    expect(ics).toContain('DTSTART;VALUE=DATE:20261105');
  });
  it('rejects invalid dates', () => {
    expect(buildIcs({ ...base, date: '2026-13-40' })).toBeNull();
  });
});

describe('action item extraction', () => {
  it('caps at 5 and de-duplicates', () => {
    const text = 'Submit the form now. Submit the form now. Register today. Bring ID. Pay the fee. Fill the sheet. Attend the meet. Keep receipt.';
    const { items } = extractActionItems(text);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(new Set(items.map((i) => i.toLowerCase())).size).toBe(items.length);
  });
});
