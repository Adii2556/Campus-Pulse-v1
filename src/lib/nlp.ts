import type { CampusItem, Category, Priority, ItemKind } from './types';
import { todayISO, toISO, isValidISODate, isTimeValid } from './dates';

/* =================================================================
   Campus Pulse — on-device notice parser
   Turns messy forwarded text (WhatsApp / email / poster caption)
   into a structured CampusItem. No network, no keys, works offline.
   ================================================================= */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_RE = Object.keys(MONTHS).join('|');
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const WEEKDAY_RE = Object.keys(WEEKDAYS).join('|');

export interface ParsedDate {
  iso: string | null;
  raw: string | null;
  /** internal ranking strength for picking among candidates — NOT shown to users */
  strength: number;
  kind: 'explicit' | 'relative' | 'weekday' | 'inferred' | null;
  otherCandidates: string[];
}

const daysFromNow = (reference: Date, iso: string): number =>
  Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(toISO(reference) + 'T00:00:00').getTime()) / 86400000);

const mkDate = (y: number, mo: number, d: number): string | null => {
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null; // overflow → invalid
  return toISO(date);
};

export function extractDate(text: string, reference: Date = new Date()): ParsedDate {
  const lower = text.toLowerCase();
  const year = reference.getFullYear();
  const candidates: { iso: string; raw: string; strength: number; kind: ParsedDate['kind'] }[] = [];
  const push = (iso: string | null, raw: string, strength: number, kind: ParsedDate['kind']) => {
    if (iso && isValidISODate(iso)) candidates.push({ iso, raw, strength, kind });
  };

  // 1) ISO yyyy-mm-dd
  let m = lower.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) push(mkDate(+m[1], +m[2] - 1, +m[3]), m[0], 100, 'explicit');

  // 2a) date RANGE — "from 3rd to 5th November 2026": event date = range start
  const rm0 = lower.match(new RegExp(
    `\\b(?:from\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|till|until|–|—|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_RE})(?:\\.?\\s*,?\\s*(20\\d{2}))?`,
  ));
  if (rm0) {
    const y = rm0[4] ? +rm0[4] : year;
    let startIso = mkDate(y, MONTHS[rm0[3]], +rm0[1]);
    if (!rm0[4] && startIso && daysFromNow(reference, startIso) < -180) startIso = mkDate(y + 1, MONTHS[rm0[3]], +rm0[1]);
    if (startIso) push(startIso, rm0[0], 96, 'explicit');
  }

  // 2b) "3 Nov 2027" style with explicit 4-digit year (reported before bare dates)
  m = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_RE})\\.?\\s*,?\\s*(20\\d{2})\\b`));
  if (m) push(mkDate(+m[3], MONTHS[m[2]], +m[1]), m[0], 95, 'explicit');
  const mAltY = lower.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(20\\d{2})\\b`));
  if (mAltY) push(mkDate(+mAltY[3], MONTHS[mAltY[1]], +mAltY[2]), mAltY[0], 95, 'explicit');

  // 3) "3 Nov" / "Nov 3" without year — roll forward if already past this year
  m = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_RE})\\.?(?!\\s*(?:to|till|until|–|—)|\\s*,?\\s*20\\d{2})`));
  if (m) {
    let iso = mkDate(year, MONTHS[m[2]], +m[1]);
    if (iso && daysFromNow(reference, iso) < -180) iso = mkDate(year + 1, MONTHS[m[2]], +m[1]);
    push(iso, m[0], 90, 'explicit');
  }
  const mAlt = lower.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\s*(?:to|till|until|–|—)|\\s*,?\\s*20\\d{2})`));
  if (mAlt) {
    let iso = mkDate(year, MONTHS[mAlt[1]], +mAlt[2]);
    if (iso && daysFromNow(reference, iso) < -180) iso = mkDate(year + 1, MONTHS[mAlt[1]], +mAlt[2]);
    push(iso, mAlt[0], 90, 'explicit');
  }

  // 4) numeric d/m or d.m optionally with year (day-first, Indian convention)
  const numRegex = /\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/g;
  for (const nm of lower.matchAll(numRegex)) {
    const before = lower.slice(Math.max(0, (nm.index ?? 0) - 18), nm.index);
    if (/(units?|chapters?|questions?|marks|pages|q[s.]?|std|between|to|from)\s*$/i.test(before)) continue;
    const d = +nm[1], mo = +nm[2];
    let y = nm[3] ? +nm[3] : year;
    if (y < 100) y += 2000;
    if (nm[3] && y < 2000) continue;
    let iso = mkDate(y, mo - 1, d);
    if (!nm[3] && iso && daysFromNow(reference, iso) < -180) iso = mkDate(y + 1, mo - 1, d);
    push(iso, nm[0], nm[3] ? 88 : 70, nm[3] ? 'explicit' : 'inferred');
  }

  // 6) relative — "today", "tomorrow", "day after tomorrow", "in N days/weeks", "N days ago"
  const relMatchers: [RegExp, number][] = [
    [/\bday\s+after\s+tomorrow\b/, 2],
    [/\btomorrow\b|\btmrw?\b/, 1],
    [/\btoday\b|\btonight\b/, 0],
    [/\byesterday\b/, -1],
  ];
  for (const [re, offset] of relMatchers) {
    const mm = lower.match(re);
    if (mm) {
      const d = new Date(reference);
      d.setDate(d.getDate() + offset);
      push(toISO(d), mm[0], 78, 'relative');
    }
  }
  m = lower.match(/\bin\s+(\d{1,2})\s+(day|days|week|weeks)\b/);
  if (m) {
    const n = +m[1] * (m[2].startsWith('week') ? 7 : 1);
    const d = new Date(reference);
    d.setDate(d.getDate() + n);
    push(toISO(d), m[0], 72, 'relative');
  }
  m = lower.match(/\b(\d{1,2})\s+(day|days|week|weeks)\s+ago\b/);
  if (m) {
    const n = +m[1] * (m[2].startsWith('week') ? 7 : 1);
    const d = new Date(reference);
    d.setDate(d.getDate() - n);
    push(toISO(d), m[0], 72, 'relative');
  }

  // 7) weekday mention — "on Friday", "this Saturday", "next Monday"
  const wm = lower.match(new RegExp(`\\b(this|next|coming)?\\s*(${WEEKDAY_RE})\\b`));
  if (wm) {
    const target = WEEKDAYS[wm[2]];
    const d = new Date(reference);
    let delta = (target - d.getDay() + 7) % 7;
    if (wm[1] === 'next') delta = delta === 0 ? 7 : delta + 7;
    else if (delta === 0) delta = 7; // "Friday" said on Friday → next Friday, not today
    d.setDate(d.getDate() + delta);
    push(toISO(d), wm[0], wm[1] ? 62 : 55, 'weekday');
  }

  if (candidates.length === 0) return { iso: null, raw: null, strength: 0, kind: null, otherCandidates: [] };
  candidates.sort((a, b) => b.strength - a.strength);
  const best = candidates[0];
  const others = [...new Set(candidates.filter((c) => c.iso !== best.iso).map((c) => c.iso))];
  return { iso: best.iso, raw: best.raw, strength: best.strength, kind: best.kind, otherCandidates: others };
}

/* ---------------- time ---------------- */

export interface ParsedTime {
  start: string | null; // HH:MM 24h
  end: string | null;
  raw: string | null;
}

const to24 = (h: number, min: number, meridiem?: string): string | null => {
  let hh = h;
  if (meridiem) {
    const isPM = meridiem.startsWith('p');
    const isAM = meridiem.startsWith('a');
    if (hh > 12 || hh < 0) return null;
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
  }
  if (min > 59 || hh > 23) return null;
  return `${String(hh).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`;
};

export function extractTime(text: string): ParsedTime {
  const lower = text.toLowerCase().replace(/\./g, '');
  // range: 4pm to 6pm | 4:00 pm - 6:00 pm | 16:00 - 18:00 | 10am-1pm
  const rangeRe = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|till|until|–|—|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/;
  const r = lower.match(rangeRe);
  if (r) {
    let meridiem1 = r[3];
    const meridiem2 = r[6];
    if (!meridiem1 && meridiem2) {
      const endH = +r[4];
      const startH = +r[1];
      // "4 to 6pm": start must sit before end — prefer same meridiem, else opposite
      const sameMer = to24(startH, +(r[2] || 0), meridiem2);
      const end24 = to24(endH, +(r[5] || 0), meridiem2);
      meridiem1 = sameMer && end24 && sameMer < end24 ? meridiem2 : meridiem2 === 'pm' ? 'am' : 'pm';
    }
    const start = to24(+r[1], +(r[2] || 0), meridiem1);
    const end = to24(+r[4], +(r[5] || 0), meridiem2);
    if (start && end) return { start, end: end > start ? end : null, raw: r[0] };
    if (start) return { start, end: null, raw: r[0] };
  }
  // single: "at 5 pm", "10:30am", "by 5:00 PM"
  const singleRe = /\b(?:at|by|from|around|before|sharp|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs|hours)\b/;
  const s = lower.match(singleRe);
  if (s) {
    const meridiem = s[3].startsWith('h') ? undefined : s[3];
    const t = to24(+s[1], +(s[2] || 0), meridiem);
    if (t) return { start: t, end: null, raw: s[0].trim() };
  }
  // 24h plain "16:00"
  const h24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return { start: `${h24[1].padStart(2, '0')}:${h24[2]}`, end: null, raw: h24[0] };
  // vague daypart — still report the daypart so the user can adjust
  const daypart: [RegExp, string][] = [
    [/\bin the morning\b|\bmorning\b/, '10:00'],
    [/\bafternoon\b/, '14:00'],
    [/\bevening\b|\btonight\b|\bnight\b/, '18:00'],
    [/\bnoon\b|\blunch(?:\s*time)?\b/, '12:30'],
  ];
  for (const [re, t] of daypart) {
    const mm = lower.match(re);
    if (mm) return { start: t, end: null, raw: mm[0] };
  }
  return { start: null, end: null, raw: null };
}

/* ---------------- venue ---------------- */

const VENUE_KEYWORDS =
  /\b((?:main\s+|central\s+|open\s+air\s+|convocation\s+)?(?:auditorium|seminar\s+hall|lecture\s+hall|lecture\s+theatre)|lt\s?\d|lh\s?\d|room\s*(?:no\.?|number)?\s*\d[\w-]*|(?:aryabhatta|raman|cv\s+raman|vyas)\s+(?:innovation\s+)?lab(?:\s*\d+)?|lab\s*\d*|canteen|cafeteria|(?:central\s+)?library|sports\s+complex|indoor\s+stadium|(?:cricket|football|basketball|tennis)\s+(?:ground|court)|(?:main|central|college|sports)\s+ground\b|ground\b|oat\b|amphitheatre|mess\b|hostel\s*(?:wing\s*)?[\w-]*|admin\s+block|accounts\s+section|exam\s+(?:cell|office)|placement\s+cell|nss\s+office|health\s+centre|student\s+centre|conference\s+room|committee\s+room|innovation\s+lab|main\s+block)\b/i;

export function extractVenue(text: string): { venue: string | null; raw: string | null } {
  // "Venue: X" / "Location: X" / "Place: X" explicit labels win (allow commas inside the venue name)
  const label = text.match(/(?:venue|location|place)\s*[:\-–]\s*([^\n;|]{3,90})/i);
  if (label) return { venue: capitalizeWords(cleanupVenue(label[1])), raw: label[0] };

  // line-aware keyword search: skip matches on signature lines ("FWD: Placement cell")
  const lineSpans: [number, number][] = [];
  {
    let pos = 0;
    for (const line of text.split('\n')) {
      const start = pos;
      pos += line.length + 1;
      lineSpans.push([start, start + line.length]);
    }
  }
  for (const kw of text.matchAll(new RegExp(VENUE_KEYWORDS, 'gi'))) {
    const idx = kw.index ?? 0;
    const span = lineSpans.find(([s, e]) => idx >= s && idx <= e);
    const line = span ? text.slice(span[0], span[1]) : '';
    if (line && isNoiseLine(line)) continue; // e.g. source signatures
    const before = text.slice(Math.max(0, idx - 48), idx);
    const nameMatch = before.match(/([A-Z][\w.&-]*(?:\s+[A-Z][\w.&-]*){0,3})\s*$/);
    const startIdx = nameMatch ? idx - nameMatch[0].length : idx;
    let end = idx + kw[0].length;
    const tail = text.slice(end, end + 14).match(/^\s*(?:no\.?|number)?\s*\d+[\w-]*/i);
    if (tail) end += tail[0].length;
    const after = text.slice(end).match(/^\s*,?\s*(?:Block|Blk|Wing)\s+[\w-]+/i);
    if (after) end += after[0].length;
    const venue = capitalizeWords(cleanupVenue(text.slice(startIdx, end)));
    if (venue.length >= 3) return { venue, raw: venue };
  }
  const prep = text.match(/(?:\bat|\bin|@)\s+([A-Z][\w&.-]*(?:\s+(?:of\s+)?[A-Z][\w&.-]*){0,4})/);
  if (prep && !/^(the|a|an|our|your|this|that|all|any)\b/i.test(prep[1])) {
    return { venue: cleanupVenue(prep[1]), raw: prep[0] };
  }
  return { venue: null, raw: null };
}

const cleanupVenue = (v: string): string =>
  v.replace(/^[\s,\-–:]+|[\s,\-–:.;|]+$/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 80);

const capitalizeWords = (v: string): string =>
  v.replace(/\b([a-z])/g, (c) => c.toUpperCase());

/* ---------------- category ---------------- */

const CATEGORY_RULES: [RegExp, Category][] = [
  [/\b(hackathon|hack-a-thon|ideathon|buildathon|coding marathon)\b/i, 'Hackathon'],
  [/\b(exam|mid[- ]?sem|end[- ]?sem|internal assessment|ia[- ]?\d|test series|quiz competition|practical exam|viva|supplementary|re[- ]?exam|answer script|hall ticket|admit card)\b/i, 'Exam'],
  [/\b(placement|recruit|hiring|interview|company visit|campus drive|offer letter|internship|aptitude|gd round|group discussion|job fair|career fair|resume|cv shortlist)\b/i, 'Placement'],
  [/\b(fee|fees|tuition|payment|dues|fine|challan|receipt|scholarship|refund|mess bill|hostel fee|semester fee|exam fee|library fine)\b/i, 'Fee'],
  [/\b(fest|cultural|concert|music|dance|drama|natak|street play|nukkad|open mic|stand[- ]?up|exhibition|saras|tarang|uthsav|celebration|anniversary|day celebration|night|concert|band|dj night|comedian|play)\b/i, 'Event'],
  [/\b(workshop|seminar|webinar|lecture|talk|guest|keynote|bootcamp|masterclass|fd\w* program|training|orientation|inauguration|convocation|alumni|session on|panel)\b/i, 'Academic'],
  [/\b(submit|submission|assignment|project|report|thesis|dissertation|synopsis|abstract|deadline|last date|registration|online form|google form|apply|register|enroll|enrol|sign ?up|nomination|fill the form|googlesheet|form link)\b/i, 'Academic'],
  [/\b(sports|cricket|football|basketball|volleyball|badminton|tennis|athletics|marathon|tournament|match|tourn|inter[- ](department|college|hall))\b/i, 'Sports'],
  [/\b(club|society|cell|committee|fest)\b/i, 'Event'],
];

export function extractCategory(text: string): { category: Category } {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(text)) return { category: cat };
  }
  return { category: 'General' };
}

/* ---------------- priority, kind & lifecycle ---------------- */

export type Lifecycle = 'active' | 'cancelled' | 'postponed';

export function extractLifecycle(text: string): Lifecycle {
  const lower = text.toLowerCase();
  if (/\b(cancel+ed?|cancel(?:l)?ation|call(?:ed)?\s*off|called\s*off|scrapped|withdrawn|drop(?:ped|ping)?\s+of)\b/.test(lower)) return 'cancelled';
  if (/\b(postpon(ed|ement)|reschedul(ed|e|ing)|deferred|moved\s+to|pushed\s+to|shifted\s+to)\b/.test(lower)) return 'postponed';
  return 'active';
}

export function extractPriority(text: string, dateISO: string | null, kind: ItemKind, lifecycle: Lifecycle): Priority {
  if (lifecycle !== 'active') return 'normal';
  const lower = text.toLowerCase();
  const critical =
    /\b(urgent|immediately|asap|today only|last day|last date|final reminder|final notice|mandatory|compulsory|strictly|non[- ]?negotiable|do not miss|closing today|ends today|expires today|eod|end of day)\b/.test(lower);
  if (critical) return 'critical';
  const timePressed = /\b(today|tonight)\b/.test(lower);
  const deadlineish = kind === 'deadline';
  const dueVerySoon = dateISO !== null && Math.round((new Date(dateISO + 'T00:00:00').getTime() - Date.now()) / 86400000) <= 2;
  if (deadlineish && dueVerySoon) return 'high';
  if (deadlineish) return 'high';
  if (timePressed) return 'high';
  return 'normal';
}

export function extractKind(text: string): ItemKind {
  const lower = text.toLowerCase();
  const deadlineWords =
    /\b(last date|deadline|submission|submit|fee|pay|payment|challan|nomination|enrol|hall ticket|register by|registration closes|last day to|due today|due by|closing date|apply by|application deadline|google form|form submission)\b/.test(lower);
  if (deadlineWords) return 'deadline';
  const eventWords =
    /\b(event|fest|workshop|seminar|match|tournament|concert|night|celebration|orientation|exhibition|competition|hackathon|visit|fair|camp|drive|cultural|sports)\b/.test(lower);
  if (eventWords) return 'event';
  // actions with a due date are deadlines; actions with a time/venue are events
  const hasAction = /\b(submit|register|apply|pay|fill|nominate)\b/.test(lower);
  const hasClock = /\d\s*(am|pm|:\d\d)/.test(lower);
  return hasAction && !hasClock ? 'deadline' : 'event';
}

/* ---------------- title ---------------- */

const CHATTER = new Set([
  'hi', 'hii', 'hiii', 'hello', 'hey', 'dear', 'dear students', 'dear all', 'everyone', 'all students',
  'good morning', 'good afternoon', 'good evening', 'greetings', 'respected', 'reminder', 'this is to inform',
  'attention', 'notice', 'announcement', 'circular', 'fyi', 'fwd', 'forwarded', 'important', 'update',
  'kindly', 'please note', 'note', 'dear sir', 'dear madam', 'hello everyone', 'hi everyone',
]);

export function extractTitle(text: string): { title: string; raw: string | null } {
  // explicit label wins
  const label = text.match(/(?:subject|title|event name|notice)\s*[:\-–]\s*([^\n]{4,110})/i);
  if (label) return { title: cleanTitle(label[1]), raw: label[0] };

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // pass 1: short, punchy, non-chatter lines (skip lines too long to make a clean title)
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    if (line.length > 115) continue;
    const cleaned = cleanTitle(line);
    if (isGoodTitle(cleaned)) return { title: cleaned, raw: line };
  }
  // pass 2: first substantial sentence (filler-stripped)
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const sentence = line.split(/[.!?]/)[0].trim();
    const cleaned = cleanClause(sentence);
    if (cleaned.length >= 10) {
      return { title: capitalizeFirst(truncateTitle(cleaned)), raw: sentence };
    }
  }
  // pass 3: first words of the text
  const words = cleanClause(text).split(/\s+/).slice(0, 12).join(' ');
  return { title: capitalizeFirst(truncateTitle(words) || 'Untitled notice'), raw: null };
}

const stripDecor = (s: string): string => {
  let out = s;
  // strip leading chat filler ("omg guys everyone 🥳 SARAS..." -> "SARAS...")
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/^(omg+|guys|hey|hi+|hello+|yo|folks|everyone|dear\s+(?:students?|all|sir|ma'?am|madam|\w+)|srsly|bro|dude)[\s,!:.…\-–—]+/i, '')
      .replace(/^[^A-Za-z0-9]+/, '');
    if (next === out) break;
    out = next;
  }
  return out
    .replace(/^(?:fwd|fw|forward(?:ed)?)\s*:\s*/i, '')
    .replace(/^[\s*_~#>•\-–—|:;!.()\[\]{}"']+/, '')
    .replace(/[\s*_~#>•\-–—|:;!.()\[\]{}"']+$/, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const isNoiseLine = (line: string): boolean => {
  const normalized = line.replace(/^[\s*_~#>•\-–—]+/, '').trim();
  const s = stripDecor(normalized).toLowerCase();
  if (!s) return true;
  if (CHATTER.has(s)) return true;
  if (/^(fwd|fw|forward(?:ed)?)\s*[:\-–]/i.test(normalized)) return true;
  if (/^subject\s*[:\-–]/i.test(normalized) && s.length < 60) return true;
  if (/^(dear\s+(?:students?|all|sir|ma'?am|madam|everyone|\w+)|hi\s+\w+|hello\s+\w+)[,!\s]/i.test(s) && s.length < 50) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^\+?[\d\s()-]{10,}$/.test(s)) return true; // phone numbers
  if (/^(regards|thanks|thank you|warm regards|sincerely|yours|team campus|coordinator|office|principal)\b/i.test(s) && s.length < 60) return true;
  if (line.replace(/[^\w\u0900-\u097F\u0B80-\u0BFF]/g, '').length < 6) return true;
  return false;
};

const isGoodTitle = (t: string): boolean => {
  if (t.length < 8 || t.length > 110) return false;
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  if (CHATTER.has(t.toLowerCase())) return false;
  if (/^(idk|guys|someone said|rumor|rumour)/i.test(t)) return false;
  const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
  if (upperRatio > 0.6) return true; // SHOUTED headline
  if (/^[A-Z0-9]/.test(t) && t.split(' ').length <= 14) return true;
  return /[A-Za-z]{4,}/.test(t) && t.split(' ').length <= 16;
};

const cleanTitle = (t: string): string => truncateTitle(stripDecor(t));

const capitalizeFirst = (s: string): string =>
  s.replace(/^([a-z])/, (c) => c.toUpperCase());

const cleanClause = (s: string): string => {
  let out = stripDecor(s);
  for (let i = 0; i < 3; i++) {
    const next = out.replace(/^(someone said|apparently|rumour(?:s)?(?:\s+(?:is|are|has|had))?|rumor(?:s)?(?:\s+(?:is|are|has|had))?|idk|not sure|confirm\s*pls|pls confirm|update)\b[\s,:!.-]*/i, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(/^[^A-Za-z0-9]+/, '').replace(/\s{2,}/g, ' ').trim();
};

const truncateTitle = (t: string): string => {
  if (t.length <= 96) return t;
  const cut = t.slice(0, 96);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
};

/* ---------------- summary ---------------- */

const SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/;

export function extractSummary(text: string, title: string): { summary: string } {
  const clean = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(^|\n)\s*[*_~#>]*\s*(?:fwd|fw|forward(?:ed)?)\s*[:\-–]?[^\n]*/gi, ' ')
    .replace(/(^|\n)\s*subject\s*[:\-–][^\n]*/gi, ' ')
    .replace(/(^|\n)\s*dear\s+[\w.'’\-& ]{0,40}(?:,|!|\n)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !isNoiseLine(s) && s.toLowerCase() !== title.toLowerCase());
  if (sentences.length === 0) return { summary: cleanTitle(clean).slice(0, 160) };
  let picked = sentences.slice(0, 2).join(' ');
  if (picked.length > 220) picked = picked.slice(0, 217).trim() + '…';
  return { summary: picked };
}

/* ---------------- action items ---------------- */

const ACTION_VERBS =
  /\b(submit|register|apply|pay|bring|carry|fill|sign|collect|download|upload|complete|appear|attend|verify|confirm|bring|hand over|deposit|clear|renew|book|reserve|join|report|visit|check|keep|wear|do not|don't|must|need to|required to|are required|have to|should)\b/i;

const ACTION_DATE_RE = new RegExp(
  `(${MONTH_RE}|tomorrow|today|by|before|on|last date|deadline)`,
  'i',
);

export function extractActionItems(text: string): { items: string[]; actionDeadline: string | null } {
  const lines = text.split(/\n|(?<=[.!?])\s+/);
  const actionItems: string[] = [];
  const seen = new Set<string>();
  let actionDeadline: string | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/^[\s*•\-–►▪◦·]+/, '');
    if (line.length < 10) continue;
    if (isNoiseLine(line)) continue;
    const hasVerb = ACTION_VERBS.test(line);
    const hasDate = /\d/.test(line) && ACTION_DATE_RE.test(line);
    if (hasVerb || hasDate) {
      let item = stripDecor(line);
      if (item.length > 140) item = item.slice(0, 137).trim() + '…';
      const key = item.toLowerCase().slice(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        actionItems.push(item);
      }
      // capture the earliest action-driving date as the action deadline
      const dateP = extractDate(line);
      if (dateP.iso) {
        if (!actionDeadline || dateP.iso < actionDeadline) actionDeadline = dateP.iso;
      }
    }
    if (actionItems.length >= 5) break;
  }
  return { items: actionItems, actionDeadline };
}

/* ---------------- main entry ---------------- */

export interface AnalyzeResult {
  item: CampusItem;
  warnings: string[];
}

/** duplicate fingerprint: normalized title + date + time */
export const noticeFingerprint = (item: Pick<CampusItem, 'title' | 'date' | 'time'>): string =>
  `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)}|${item.date ?? ''}|${item.time ?? ''}`;

export function analyzeNotice(rawText: string, opts?: { reference?: Date }): AnalyzeResult | null {
  const text = rawText.replace(/\r/g, '').trim();
  if (text.length < 12) return null;

  const warnings: string[] = [];
  const reference = opts?.reference ?? new Date();

  const lifecycle = extractLifecycle(text);
  if (lifecycle === 'cancelled') warnings.push('This notice reads as a cancellation — marked as cancelled, not an action item.');
  else if (lifecycle === 'postponed') warnings.push('This notice reads as postponed — verify the new date in the text before relying on it.');

  const dateP = extractDate(text, reference);
  if (!dateP.iso) warnings.push('No date detected — added to the feed as an undated notice.');
  else if (dateP.otherCandidates.length > 0) {
    warnings.push(`Multiple dates detected; used ${dateP.iso}. Also found: ${dateP.otherCandidates.join(', ')} — please verify.`);
  } else if (dateP.kind === 'inferred') warnings.push('Date inferred from a numeric pattern — please double-check it.');
  else if (dateP.kind === 'weekday') warnings.push('Weekday-only mention — date computed against today.');

  const timeP = extractTime(text);
  const venueP = extractVenue(text);
  if (!venueP.venue) warnings.push('No venue detected.');

  const categoryP = extractCategory(text);
  if (categoryP.category === 'General') warnings.push('Category unclear — defaulted to General.');

  const kind = extractKind(text);
  const priority = extractPriority(text, dateP.iso, kind, lifecycle);
  if (dateP.iso && daysFromNow(reference, dateP.iso) < 0 && lifecycle === 'active') {
    warnings.push('The extracted date is in the past — expired items are kept for records, not counted as overdue.');
  }

  const titleP = extractTitle(text);
  const summaryP = extractSummary(text, titleP.title);
  const { items: actionItems, actionDeadline } = extractActionItems(text);

  const item: CampusItem = {
    id: `ana-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: titleP.title,
    date: dateP.iso,
    time: timeP.start,
    endTime: timeP.end,
    venue: venueP.venue,
    category: categoryP.category,
    priority,
    kind,
    summary: summaryP.summary,
    actionItems,
    actionDeadline,
    checkedActions: [],
    done: false,
    status: lifecycle === 'active' ? undefined : lifecycle,
    source: 'analyzed',
    engine: 'heuristic',
    rawText: text,
    createdAt: new Date().toISOString(),
  };
  return { item, warnings };
}

/* ---------------- optional LLM upgrade (Bring Your Own Key) ----------------
   Strict contract:
   - 10s AbortController timeout, caller-provided AbortSignal supported
   - response validated field-by-field; invalid values are rejected, never trusted
   - on ANY failure the caller gets a labelled fallback (engine: 'heuristic')
   - no fabricated confidence scores anywhere                             */

export function llmConfigured(key?: string | null): boolean {
  if (key && key.trim()) return true;
  try {
    return Boolean(
      (import.meta as any).env?.VITE_OPENAI_API_KEY ||
        (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('campuspulse.openaiKey.v1'))),
    );
  } catch {
    return false;
  }
}

const AI_CATEGORIES: Category[] = ['Academic', 'Exam', 'Event', 'Placement', 'Fee', 'Sports', 'Hackathon', 'General'];
const AI_PRIORITIES: Priority[] = ['critical', 'high', 'normal'];

interface RawAiNotice {
  title?: unknown; date?: unknown; time?: unknown; endTime?: unknown; venue?: unknown;
  category?: unknown; priority?: unknown; kind?: unknown; summary?: unknown; actionItems?: unknown;
}

export function validateAiNoticeForTest(raw: RawAiNotice): Partial<CampusItem> | null {
  return validateAiNotice(raw);
}

function validateAiNotice(raw: RawAiNotice): Partial<CampusItem> | null {
  const out: Partial<CampusItem> = {};
  if (typeof raw.title === 'string' && raw.title.trim().length >= 3 && raw.title.length <= 200) {
    out.title = raw.title.trim();
  }
  if (raw.date === null) out.date = null;
  else if (typeof raw.date === 'string' && isValidISODate(raw.date.trim())) out.date = raw.date.trim();
  // undefined/invalid → field dropped (caller keeps heuristic value)
  if (raw.time === null) out.time = null;
  else if (typeof raw.time === 'string' && isTimeValid(raw.time.trim())) out.time = raw.time.trim();
  if (raw.endTime === null) out.endTime = null;
  else if (typeof raw.endTime === 'string' && isTimeValid(raw.endTime.trim())) out.endTime = raw.endTime.trim();
  if (raw.venue === null) out.venue = null;
  else if (typeof raw.venue === 'string' && raw.venue.trim().length >= 2 && raw.venue.length <= 120) out.venue = raw.venue.trim();
  if (typeof raw.category === 'string' && (AI_CATEGORIES as string[]).includes(raw.category)) out.category = raw.category as Category;
  if (typeof raw.priority === 'string' && (AI_PRIORITIES as string[]).includes(raw.priority)) out.priority = raw.priority as Priority;
  if (raw.kind === 'event' || raw.kind === 'deadline') out.kind = raw.kind;
  if (typeof raw.summary === 'string' && raw.summary.trim().length >= 10 && raw.summary.length <= 600) out.summary = raw.summary.trim();
  if (Array.isArray(raw.actionItems)) {
    const items = raw.actionItems.filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter((a) => a.length >= 4).slice(0, 5);
    if (items.length > 0) out.actionItems = items;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function analyzeWithLLM(
  rawText: string,
  byokKey?: string | null,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<AnalyzeResult | null> {
  let key = byokKey?.trim() || null;
  if (!key) {
    try {
      key = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? localStorage.getItem('campuspulse.openaiKey.v1');
    } catch {
      key = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? null;
    }
  }
  if (!key) return analyzeNotice(rawText);

  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // link caller cancellation
  const onCallerAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onCallerAbort);

  const local = analyzeNotice(rawText);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You extract structured data from messy Indian college campus notices. Today is ' +
              todayISO() +
              ' (Asia/Kolkata campus, day-first dates). Reply ONLY with JSON: {"title": string (<=90 chars), "date": "YYYY-MM-DD"|null, "time": "HH:MM" 24h|null, "endTime": "HH:MM"|null, "venue": string|null, "category": one of Academic|Exam|Event|Placement|Fee|Sports|Hackathon|General, "priority": one of critical|high|normal, "kind": "event"|"deadline", "summary": string (1-2 sentences), "actionItems": string[] (max 5)}. If unsure, use null — never invent dates.',
          },
          { role: 'user', content: rawText.slice(0, 4000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Malformed AI response');
    let parsedRaw: RawAiNotice;
    try {
      parsedRaw = JSON.parse(content);
    } catch {
      throw new Error('AI returned invalid JSON');
    }
    const validated = validateAiNotice(parsedRaw);
    if (!validated) throw new Error('AI response failed validation');
    if (!local) return null;
    const item: CampusItem = {
      ...local.item,
      ...validated,
      engine: 'llm',
      // AI wins when validated; otherwise the local extraction stands
      actionItems: validated.actionItems ?? local.item.actionItems,
      actionDeadline: local.item.actionDeadline ?? null,
      checkedActions: [],
    };
    return { item, warnings: [] };
  } catch (err) {
    if (controller.signal.aborted && opts?.signal?.aborted) return null; // caller cancelled
    const reason = controller.signal.aborted ? 'request timed out' : err instanceof Error ? err.message : 'unknown error';
    if (!local) return null;
    return {
      item: local.item,
      warnings: [`AI extraction unavailable (${reason}) — used the on-device engine instead.`],
    };
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/* ---------------- weekly AI digest (BYO key) ---------------- */

export interface AiDigestResult {
  headline: string;
  sections: { heading: string; lines: string[] }[];
}

export async function generateAiDigest(
  items: CampusItem[],
  byokKey?: string | null,
  opts?: { signal?: AbortSignal; timeoutMs?: number; rangeLabel?: string },
): Promise<AiDigestResult | null> {
  let key = byokKey?.trim() || null;
  if (!key) {
    try {
      key = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? localStorage.getItem('campuspulse.openaiKey.v1');
    } catch {
      key = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? null;
    }
  }
  if (!key) return null;

  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onCallerAbort);

  const compact = items
    .filter((i) => !i.done)
    .slice(0, 30)
    .map((i) => ({
      title: i.title, date: i.date, time: i.time, category: i.category,
      priority: i.priority, kind: i.kind, venue: i.venue, done: i.done,
    }));

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a campus life editor writing a weekly digest for an Indian college student. Today is ' +
              todayISO() +
              (opts?.rangeLabel ? `; the digest covers ${opts.rangeLabel}` : '') +
              '. From the JSON list of notices, reply ONLY with JSON: {"headline": string (max 90 chars, specific to the data), "sections": [{"heading": string, "lines": string[]}]}. Use 3 sections: "Needs attention today", "Coming up this week", "Pulse insights" (2-4 punchy bullet observations). Each line max 140 chars. No invented notices. Empty arrays are fine — say things are quiet instead of fabricating.',
          },
          { role: 'user', content: JSON.stringify(compact) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Malformed AI response');
    const parsed = JSON.parse(content) as { headline?: unknown; sections?: unknown };
    if (typeof parsed.headline !== 'string' || parsed.headline.trim().length < 5) throw new Error('AI headline missing');
    if (!Array.isArray(parsed.sections)) throw new Error('AI sections missing');
    const sections = parsed.sections
      .filter((s): s is { heading?: unknown; lines?: unknown } => typeof s === 'object' && s !== null)
      .map((s) => ({
        heading: typeof s.heading === 'string' && s.heading.trim() ? s.heading.trim().slice(0, 60) : 'Notes',
        lines: Array.isArray(s.lines)
          ? s.lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 2).map((l) => l.trim().slice(0, 200)).slice(0, 8)
          : [],
      }))
      .filter((s) => s.lines.length > 0)
      .slice(0, 5);
    if (sections.length === 0) throw new Error('AI sections failed validation');
    return { headline: parsed.headline.trim().slice(0, 120), sections };
  } catch {
    return null; // caller shows the on-device digest clearly labelled as fallback
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onCallerAbort);
  }
}
