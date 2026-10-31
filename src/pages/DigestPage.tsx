import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CalendarDays, Flame, AlertOctagon, Lightbulb, Copy, Check, NotebookPen, ArrowRight, Share, Cpu, CircleAlert } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../components/Toast';
import { generateDigest, type Digest } from '../lib/digest';
import { generateAiDigest } from '../lib/nlp';
import { formatTime, todayISO } from '../lib/dates';

const AI_LINES: Record<string, string> = {
  today: 'text-amber-900',
  overdue: 'text-red-900',
  week: 'text-primary-deep',
  insight: 'text-violet-900',
};

export default function DigestPage() {
  const navigate = useNavigate();
  const { items, counts, apiKey } = useStore();
  const { toast } = useToast();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [aiDigest, setAiDigest] = useState<{ headline: string; sections: { heading: string; lines: string[] }[] } | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const today = todayISO();
  const upcomingPool = useMemo(
    () =>
      items
        .filter((i) => !i.done && i.status !== 'cancelled' && i.date && i.date >= today)
        .sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')))
        .slice(0, 6),
    [items, today],
  );

  // local digest renders instantly; AI digest upgrades it when a key is set
  useEffect(() => {
    setRevealed(false);
    const d = generateDigest(items);
    setDigest(d);
    const t = window.setTimeout(() => setRevealed(true), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAi = useCallback(async () => {
    if (!apiKey) {
      setAiState('idle');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiState('loading');
    const result = await generateAiDigest(items, apiKey, { signal: controller.signal, rangeLabel: digest?.range });
    if (controller.signal.aborted) return;
    if (result) {
      setAiDigest(result);
      setAiState('ready');
    } else {
      setAiDigest(null);
      setAiState('fallback');
    }
  }, [apiKey, items, digest?.range]);

  useEffect(() => {
    runAi();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = () => {
    setGenerating(true);
    setRevealed(false);
    window.setTimeout(() => {
      setDigest(generateDigest(items));
      setGenerating(false);
      setRevealed(true);
    }, 350);
    runAi().finally(() => {
      setGenerating(false);
    });
  };

  const activeEngine = aiDigest && aiState === 'ready' ? 'ai' : 'heuristic';
  const headline = activeEngine === 'ai' ? aiDigest!.headline : digest?.headline;
  const sections =
    activeEngine === 'ai'
      ? aiDigest!.sections.map((s) => ({ icon: 'insight' as const, heading: s.heading, lines: s.lines }))
      : digest?.sections ?? [];

  const asText = digest
    ? [
        `Campus Pulse — Weekly Digest (${digest.range})`,
        (headline ?? '').toUpperCase(),
        activeEngine === 'heuristic' ? '[On-device digest — add an OpenAI key in Settings for AI]' : '[AI digest — GPT-4o mini, validated]',
        '',
        ...sections.flatMap((s) => [s.heading.toUpperCase(), ...s.lines.map((l) => `  ${l}`), '']),
        '— campuspulse',
      ].join('\n')
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      toast('Digest copied to clipboard');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Clipboard blocked on this browser');
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(asText)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative overflow-hidden px-4 pt-6 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute -top-8 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        {/* masthead */}
        <div className="rounded-3xl border border-primary-deep/25 bg-primary-deep p-5 text-[#FAF4E9] card-shadow sm:p-7">
          <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-3">
            <div className="flex items-center gap-2">
              <NotebookPen size={16} className="text-amber-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">Campus Pulse Weekly</span>
            </div>
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#B9CBBD]">{digest?.range ?? ''}</span>
          </div>
          <motion.h1
            key={headline}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 font-serif text-3xl font-semibold leading-tight text-[#FDF9EE] sm:text-4xl"
          >
            {generating ? 'Reading your campus…' : headline ?? 'What do I need to know this week?'}
          </motion.h1>
          <p className="mt-2 max-w-md text-[12px] leading-relaxed text-[#C9D8CC]">
            Everything you actually need, distilled from {counts.active} live notice{counts.active === 1 ? '' : 's'} — no WhatsApp archaeology required.
          </p>
          {/* engine label — honest about what wrote this */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[9.5px] font-semibold uppercase tracking-wider">
            {aiState === 'loading' && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[#C9D8CC]"><Sparkles size={11} className="animate-pulse" /> AI drafting your digest…</span>
            )}
            {aiState === 'ready' && (
              <span className="flex items-center gap-1.5 rounded-full border border-violet-300/50 bg-violet-400/15 px-2.5 py-1 text-violet-200"><Sparkles size={11} /> AI digest · GPT-4o mini · validated</span>
            )}
            {aiState === 'fallback' && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-1 text-amber-200"><CircleAlert size={11} /> AI unavailable — on-device digest shown</span>
            )}
            {aiState === 'idle' && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[#B9CBBD]"><Cpu size={11} /> On-device digest</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={regenerate} disabled={generating} className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-amber-950 transition hover:bg-amber-300 disabled:opacity-60">
              <Sparkles size={13} className={generating ? 'animate-spin' : ''} /> {generating ? 'Digesting…' : 'Regenerate digest'}
            </button>
            <button onClick={copy} className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-[#FAF4E9] transition hover:bg-white/10">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy text'}
            </button>
            <button onClick={shareWhatsApp} className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-[#FAF4E9] transition hover:bg-white/10">
              <Share size={13} /> Forward
            </button>
          </div>
        </div>

        {/* sections */}
        <div className="mt-5 space-y-3">
          {sections.map((section, si) => {
            const Icon = section.icon === 'today' ? Flame : section.icon === 'overdue' ? AlertOctagon : section.icon === 'week' ? CalendarDays : Lightbulb;
            return (
              <motion.section
                key={`${activeEngine}-${section.heading}-${si}`}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 22 }}
                transition={{ duration: 0.45, delay: si * 0.12 }}
                className="overflow-hidden rounded-2xl border border-line bg-card card-shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-line bg-paper/70 px-4 py-2.5">
                  <Icon size={15} className={AI_LINES[section.icon] ?? AI_LINES.insight} strokeWidth={2.2} />
                  <h2 className="font-display text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-soft">{section.heading}</h2>
                </div>
                <ul className="space-y-1.5 px-4 py-3">
                  {section.lines.map((line, li) => {
                    const isDay = section.icon === 'week' && !line.startsWith('   ');
                    return (
                      <li
                        key={li}
                        className={
                          isDay
                            ? 'pt-1 font-display text-[11.5px] font-bold text-primary-deep'
                            : `text-[12px] leading-relaxed ${section.icon === 'week' ? 'pl-3 text-ink-soft' : 'text-ink'}`
                        }
                      >
                        {line}
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            );
          })}
        </div>

        {/* up next strip — only today & future */}
        <div className="mt-6">
          <p className="mb-2 flex items-center justify-between font-display text-[10px] font-bold uppercase tracking-[0.3em] text-ink-faint">
            Up next
            <button onClick={() => navigate('/board')} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">Open board <ArrowRight size={11} /></button>
          </p>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {upcomingPool.length === 0 && <p className="text-[12px] text-ink-faint">Nothing on the radar — the week ahead is genuinely clear.</p>}
            {upcomingPool.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate('/board')}
                className="w-56 shrink-0 rounded-2xl border border-line bg-card p-3 text-left card-shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-terracotta">
                  {item.date && new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{item.time ? ` · ${formatTime(item.time)}` : ''}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-ink">{item.title}</p>
                {item.venue && <p className="mt-1 truncate text-[10px] text-ink-faint">{item.venue}</p>}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center font-serif text-[11px] italic text-ink-faint">“The goal is not to read every notice. It’s to miss nothing that matters.”</p>
      </div>
    </div>
  );
}
