import {
  GraduationCap, NotebookPen, Sparkles, Briefcase, IndianRupee, Trophy, Rocket, Megaphone,
  type LucideIcon,
} from 'lucide-react';
import type { Category, Priority, ItemStatus } from './types';

export const CATEGORY_META: Record<Category, { icon: LucideIcon; chip: string; dot: string; soft: string }> = {
  Academic: { icon: GraduationCap, chip: 'bg-emerald-50 text-emerald-900 border-emerald-200', dot: '#059669', soft: '#D1FAE5' },
  Exam: { icon: NotebookPen, chip: 'bg-rose-50 text-rose-900 border-rose-200', dot: '#E11D48', soft: '#FFE4E6' },
  Event: { icon: Sparkles, chip: 'bg-violet-50 text-violet-900 border-violet-200', dot: '#7C3AED', soft: '#EDE9FE' },
  Placement: { icon: Briefcase, chip: 'bg-sky-50 text-sky-900 border-sky-200', dot: '#0284C7', soft: '#E0F2FE' },
  Fee: { icon: IndianRupee, chip: 'bg-amber-50 text-amber-900 border-amber-200', dot: '#D97706', soft: '#FEF3C7' },
  Sports: { icon: Trophy, chip: 'bg-lime-50 text-lime-900 border-lime-200', dot: '#65A30D', soft: '#ECFCCB' },
  Hackathon: { icon: Rocket, chip: 'bg-orange-50 text-orange-900 border-orange-200', dot: '#EA580C', soft: '#FFEDD5' },
  General: { icon: Megaphone, chip: 'bg-stone-100 text-stone-700 border-stone-300', dot: '#78716C', soft: '#F5F5F4' },
};

export const PRIORITY_META: Record<Priority, { label: string; chip: string; stamp: string }> = {
  critical: { label: 'Critical', chip: 'bg-red-100 text-red-900 border-red-300', stamp: 'border-red-600 text-red-700' },
  high: { label: 'High', chip: 'bg-amber-100 text-amber-900 border-amber-300', stamp: 'border-amber-600 text-amber-700' },
  normal: { label: 'Normal', chip: 'bg-stone-100 text-stone-600 border-stone-200', stamp: 'border-stone-400 text-stone-500' },
};

export const STATUS_META: Record<ItemStatus, { label: string; chip: string; block: string }> = {
  today: { label: 'Today', chip: 'bg-amber-400 text-amber-950 border-amber-500', block: 'bg-amber-400 text-amber-950' },
  overdue: { label: 'Overdue', chip: 'bg-red-100 text-red-900 border-red-300', block: 'bg-red-600 text-white' },
  upcoming: { label: 'Upcoming', chip: 'bg-emerald-100 text-emerald-900 border-emerald-300', block: 'bg-[#0E4C38] text-[#FAF4E9]' },
  expired: { label: 'Expired', chip: 'bg-stone-200 text-stone-600 border-stone-300', block: 'bg-stone-300 text-stone-600' },
  undated: { label: 'Date TBD', chip: 'bg-sky-50 text-sky-900 border-sky-300', block: 'bg-sky-600 text-white' },
  cancelled: { label: 'Cancelled', chip: 'bg-stone-200 text-stone-500 border-stone-300', block: 'bg-stone-300 text-stone-600' },
  postponed: { label: 'Postponed', chip: 'bg-violet-100 text-violet-900 border-violet-300', block: 'bg-violet-600 text-white' },
};
