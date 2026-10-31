export type Category =
  | 'Academic'
  | 'Exam'
  | 'Event'
  | 'Placement'
  | 'Fee'
  | 'Sports'
  | 'Hackathon'
  | 'General';

export type Priority = 'critical' | 'high' | 'normal';
export type ItemKind = 'event' | 'deadline';
export type ItemSource = 'seed' | 'analyzed' | 'manual';
export type ItemStatus = 'cancelled' | 'postponed' | 'today' | 'overdue' | 'upcoming' | 'expired' | 'undated';

export interface CampusItem {
  id: string;
  title: string;
  /** ISO date yyyy-mm-dd, or null when the notice has no date */
  date: string | null;
  /** 24h "HH:MM" */
  time: string | null;
  endTime: string | null;
  venue: string | null;
  category: Category;
  priority: Priority;
  kind: ItemKind;
  summary: string;
  actionItems: string[];
  /** Optional: ISO date an action must be completed by (from a deadline notice) */
  actionDeadline?: string | null;
  /** indexes of ticked action items (persisted) */
  checkedActions: number[];
  done: boolean;
  /** explicit override for cancelled / postponed notices */
  status?: 'cancelled' | 'postponed';
  source: ItemSource;
  engine: 'llm' | 'heuristic' | 'seed';
  rawText?: string;
  createdAt: string;
}

export const CATEGORIES: Category[] = [
  'Academic',
  'Exam',
  'Event',
  'Placement',
  'Fee',
  'Sports',
  'Hackathon',
  'General',
];
