/** Quick lexical stats for the Paste Studio input meter. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

const SIGNAL_WORDS =
  /\b(date|time|venue|register|deadline|submit|fee|exam|event|workshop|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|last date|portal|hall|auditorium|lab|ground|o'clock|nomination|apply|link)\b/gi;

/** 0..100 — how likely the text yields a dense card */
export function readinessScore(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  const signalHits = (t.match(SIGNAL_WORDS) ?? []).length;
  const hasDigits = /\d/.test(t);
  const hasUrl = /https?:\/\//.test(t);
  let score = Math.min(45, words * 2.2);
  score += Math.min(40, signalHits * 9);
  if (hasDigits) score += 8;
  if (hasUrl) score += 7;
  return Math.min(100, Math.round(score));
}
