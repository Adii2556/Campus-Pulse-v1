import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ArrowRight, MapPin, CalendarDays, Clock, Pencil, RotateCcw, Plus,
  Sparkles, ClipboardPaste, Bookmark, AlertTriangle, ChevronRight, Wand2, ListChecks, X,
} from 'lucide-react';
import { analyzeNotice, analyzeWithLLM } from '../lib/nlp';
import type { AnalyzeResult } from '../lib/nlp';
import type { CampusItem, Category, Priority, ItemKind } from '../lib/types';
import { CATEGORIES } from '../lib/types';
import { useStore } from '../lib/store';
import { useToast } from '../components/Toast';
import { SAMPLE_NOTICES } from '../lib/samples';
import { countWords, readinessScore } from '../lib/textStats';
import { CATEGORY_META } from '../lib/meta';

const SCAN_STEPS = ['Reading the notice…', 'Spotting dates & times…', 'Finding venue & category…', 'Flagging urgency & actions…'];

export default function Home() {
  const navigate = useNavigate();
  const { addItem, saveRaw, counts, apiKey, isSaved: _isSaved, items } = useStore();
  const { toast } = useToast();

  const [raw, setRaw] = useState('');
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'result'>('idle');
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<CampusItem | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const words = countWords(raw);
  const readiness = readinessScore(raw);

  // Settings modal can push a saved clip into the studio
  useEffect(() => {
    const onLoadRaw = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string' && text.trim()) {
        setRaw(text);
        setPhase('idle');
        setResult(null);
        setDraft(null);
        window.setTimeout(() => taRef.current?.focus({ preventScroll: false }), 120);
      }
    };
    window.addEventListener('campuspulse:load-raw', onLoadRaw);
    return () => window.removeEventListener('campuspulse:load-raw', onLoadRaw);
  }, []);

  useEffect(() => {
    if (phase !== 'scanning') return;
    setScanStep(0);
    const controller = new AbortController();
    abortRef.current = controller;
    const t = window.setInterval(() => setScanStep((s) => (s >= SCAN_STEPS.length - 1 ? s : s + 1)), 220);

    const finish = (r: AnalyzeResult | null) => {
      if (controller.signal.aborted) return;
      window.clearInterval(t);
      setResult(r);
      setDraft(r?.item ?? null);
      setPhase('result');
      setEditMode(false);
    };

    if (apiKey) {
      // AI path: 10s timeout inside analyzeWithLLM, labelled fallback on failure
      analyzeWithLLM(raw, apiKey, { signal: controller.signal, timeoutMs: 10_000 })
        .then((r) => finish(r))
        .catch(() => finish(analyzeNotice(raw)));
    } else {
      const done = window.setTimeout(() => finish(analyzeNotice(raw)), 950);
      return () => { window.clearInterval(t); window.clearTimeout(done); controller.abort(); };
    }
    return () => { window.clearInterval(t); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    setPhase('idle');
  };

  const analyze = (text?: string) => {
    const t = (text ?? raw).trim();
    if (t.length < 12) {
      toast('Paste at least a sentence or two first');
      return;
    }
    if (text) setRaw(text);
    setPhase('scanning');
  };

  const addToFeed = () => {
    if (!draft) return;
    const r = addItem({ ...draft, id: `notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` });
    if (!r.ok) {
      toast('That notice is already on your board');
      return;
    }
    toast('Added to your board');
    navigate('/board');
  };

  const stats = useMemo(
    () => [
      { n: counts.active, label: 'active notices' },
      { n: counts.critical, label: 'critical flags' },
      { n: counts.week, label: 'due by Sunday' },
    ],
    [counts],
  );

  return (
    <div className="px-4 pt-6 sm:px-6 md:pt-10">
      {/* ================= HERO ================= */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="relative z-10 lg:col-span-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1.5 pr-3 card-shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
              <Zap size={11} strokeWidth={3} className="text-amber-950" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-ink-soft">Built for the campus notice chaos</span>
          </div>

          <h1 className="font-serif text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-primary-deep sm:text-6xl xl:text-[4.2rem]">
            One clear pulse<br />
            <span className="relative inline-block whitespace-nowrap">
              on campus life.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 320 14" fill="none" aria-hidden>
                <path d="M4 9c60-5 120 3 180-2 45-4 90-2 132 1" stroke="#F0A500" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
              </svg>
            </span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base">
            Paste any messy forwarded notice — WhatsApp chaos, hostel emails, poster captions.
            Campus Pulse turns it into a structured, actionable card. In seconds.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={() => taRef.current?.focus({ preventScroll: false })} className="btn-primary">
              Tame a notice <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/board')} className="btn-ghost">
              See my board <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-7 flex items-center gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-xl font-bold text-primary-deep">{s.n}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* illustration card */}
        <div className="relative lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-3xl border-4 border-card card-shadow"
          >
            <img src="/images/campus-illustration.png" alt="Illustration of students around a campus notice board with the clock tower behind" className="h-56 w-full object-cover object-[50%_30%] sm:h-72 lg:h-96" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-deep/55 via-primary-deep/5 to-transparent" />
            {/* floating notice chip */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-4 top-4 w-44 rotate-[-3deg] rounded-xl border border-line bg-card/95 p-2.5 card-shadow backdrop-blur"
            >
              <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-terracotta">fwd: hostel notice</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-ink-soft">water supply tomorrow 5am-7am all hostels must fill buckets tonight…</p>
            </motion.div>
            <motion.div
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              className="absolute bottom-4 right-4 w-48 rotate-[2deg] rounded-xl border border-emerald-900/20 bg-[#0E4C38]/95 p-2.5 text-[#FAF4E9] card-shadow backdrop-blur"
            >
              <p className="flex items-center gap-1 font-display text-[8px] font-bold uppercase tracking-wider text-amber-400"><Wand2 size={9} /> Campus Pulse</p>
              <p className="mt-0.5 text-[9px] font-semibold leading-snug">Water supply maintenance · Tomorrow, 5:00 AM · Fill buckets tonight</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= PASTE STUDIO ================= */}
      <section id="analyze" className="mx-auto mt-10 max-w-6xl scroll-mt-24 md:mt-16">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-terracotta"><ClipboardPaste size={12} /> Paste studio</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary-deep sm:text-3xl">Dump the message. Get the card.</h2>
          </div>
          <p className="max-w-[260px] text-right text-[10.5px] leading-snug text-ink-faint">On-device by default — your text never leaves the browser. Add an OpenAI key in Settings for AI-grade extraction.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* -------- input panel -------- */}
          <div className="relative overflow-hidden rounded-3xl border border-primary-deep/30 bg-primary-deep p-4 text-[#EDE7D6] card-shadow sm:p-5 lg:col-span-6">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">Messy input</span>
              <button
                onClick={() => { setRaw(''); setPhase('idle'); setResult(null); taRef.current?.focus(); }}
                className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-[#EDE7D6]/80 transition hover:bg-white/10"
              >
                <RotateCcw size={11} /> Clear
              </button>
            </div>
            <textarea
              ref={taRef}
              value={raw}
              onChange={(e) => { setRaw(e.target.value); if (phase === 'result') setPhase('idle'); }}
              placeholder={'Paste anything:\n\n"URGENT: 5th sem fee last date TODAY 5pm pay on portal…"\n\nforwarded chain, hostel circular, poster caption — anything.'}
              className="h-48 w-full resize-y rounded-2xl border border-white/10 bg-[#0A2C20] p-4 font-mono text-[12.5px] leading-relaxed text-[#F4EFDF] placeholder-[#7E9484] outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25 sm:h-56"
              spellCheck={false}
              aria-label="Paste a notice here"
            />
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#9DB4A3]">
              <span>{words} words · {readiness < 15 ? 'waiting for text' : readiness < 70 ? 'enough to work with' : 'rich notice — expect a clean card'}</span>
              {raw.length > 0 && <span className="text-amber-400/90">{Math.min(100, Math.round(readiness))}% signal</span>}
            </div>

            {/* sample chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SAMPLE_NOTICES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => analyze(s.text)}
                  className="group max-w-full rounded-full border border-amber-400/30 bg-amber-400/5 py-1 pl-2.5 pr-2 text-[10px] font-medium text-amber-200/90 transition hover:border-amber-400/70 hover:bg-amber-400/15 hover:text-amber-100"
                  title={s.text.slice(0, 120)}
                >
                  <Zap size={10} className="mr-1 inline text-amber-400" />{s.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => analyze()}
              disabled={phase === 'scanning' || raw.trim().length < 12}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 font-display text-[15px] font-bold uppercase tracking-wide text-amber-950 shadow-[0_10px_28px_-8px_rgba(240,165,0,0.55)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'scanning' ? (
                <><Sparkles size={17} className="animate-pulse" /> Reading your campus…</>
              ) : (
                <><Wand2 size={17} /> Analyze notice</>
              )}
            </button>
            {phase === 'scanning' && (
              <button onClick={cancelAnalysis} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/20 py-2 text-[10.5px] font-bold uppercase tracking-wider text-[#EDE7D6]/85 transition hover:bg-white/10">
                <X size={12} /> Cancel
              </button>
            )}
          </div>

          {/* -------- output panel -------- */}
          <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-4 card-shadow sm:p-5 lg:col-span-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Structured card</span>
              {draft && phase === 'result' && (
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[10.5px] font-semibold text-ink-soft transition hover:border-primary hover:text-primary"
                >
                  <Pencil size={11} /> {editMode ? 'Done editing' : 'Edit fields'}
                </button>
              )}
            </div>

            {/* empty state */}
            {phase === 'idle' && (
              <div className="flex h-[calc(100%-2rem)] min-h-64 flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-primary-soft blur-2xl" />
                  <svg width="86" height="86" viewBox="0 0 86 86" className="relative" fill="none">
                    <rect x="14" y="10" width="42" height="54" rx="5" stroke="#0E4C38" strokeWidth="2.5" strokeDasharray="5 5" opacity="0.55" transform="rotate(-6 35 37)" />
                    <rect x="26" y="18" width="46" height="56" rx="6" fill="#FFFDF7" stroke="#0E4C38" strokeWidth="2.5" transform="rotate(3 49 46)" />
                    <path d="M36 40h26M36 50h26M36 60h16" stroke="#0E4C38" strokeWidth="2.5" strokeLinecap="round" transform="rotate(3 49 46)" />
                    <circle cx="64" cy="22" r="10" fill="#F0A500" stroke="#093626" strokeWidth="2.5" />
                    <path d="M64 17v5l3.5 2" stroke="#093626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-display text-base font-bold text-ink">Your card will appear here</p>
                  <p className="mx-auto mt-1 max-w-[280px] text-[11.5px] leading-relaxed text-ink-soft">Title, date, time, venue, category, urgency and action items — pulled out automatically.</p>
                </div>
                <button onClick={() => analyze(SAMPLE_NOTICES[0].text)} className="text-[11px] font-bold text-terracotta underline decoration-terracotta/40 underline-offset-2 hover:text-[#9A3412]">
                  Try it with a real one →
                </button>
              </div>
            )}

            {/* scanning state */}
            {phase === 'scanning' && (
              <div className="flex h-[calc(100%-2rem)] min-h-64 flex-col items-center justify-center gap-5">
                <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-paper">
                  <motion.div
                    className="absolute h-full w-24 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
                    animate={{ x: ['-150%', '850%'] }}
                    transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <ClipboardPaste size={30} className="relative text-primary/60" />
                </div>
                <div className="space-y-1.5 text-center">
                  {SCAN_STEPS.map((step, i) => (
                    <p key={step} className={`font-mono text-[11px] transition-all duration-300 ${i < scanStep ? 'text-emerald-700' : i === scanStep ? 'font-bold text-primary-deep' : 'text-ink-faint/50'}`}>
                      {i < scanStep ? '✓ ' : i === scanStep ? '▸ ' : ''}{step}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* result state */}
            {phase === 'result' && draft && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto">
                {/* engine + source */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`chip border ${draft.engine === 'llm' ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-line bg-paper text-ink-soft'}`}>
                      {draft.engine === 'llm' ? 'GPT-4o mini' : 'On-device NLP'}
                    </span>
                    <span className="font-mono text-[9.5px] text-ink-faint">{draft.engine === 'llm' ? 'AI-extracted, validated' : 'Extracted on-device'}</span>
                  </div>
                  <button onClick={() => { saveRaw(raw); toast('Raw notice saved to settings'); }} title="Save the original text" className="rounded-full border border-line p-1.5 text-ink-soft transition hover:border-primary hover:text-primary" aria-label="Save raw notice">
                    <Bookmark size={14} />
                  </button>
                </div>

                {/* warnings */}
                {result && result.warnings.length > 0 && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-700" />
                    <p className="text-[10.5px] leading-snug text-amber-900">{result.warnings.join(' ')}</p>
                  </div>
                )}

                {editMode ? (
                  <div className="grid grid-cols-1 gap-2">
                    <input className="field font-display font-semibold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" aria-label="Title" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="field" value={draft.date ?? ''} onChange={(e) => setDraft({ ...draft, date: e.target.value || null })} aria-label="Date" />
                      <input type="time" className="field" value={draft.time ?? ''} onChange={(e) => setDraft({ ...draft, time: e.target.value || null })} aria-label="Time" />
                    </div>
                    <input className="field" value={draft.venue ?? ''} onChange={(e) => setDraft({ ...draft, venue: e.target.value || null })} placeholder="Venue" aria-label="Venue" />
                    <div className="grid grid-cols-2 gap-2">
                      <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })} aria-label="Category">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="field" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ItemKind })} aria-label="Kind">
                        <option value="event">Event</option>
                        <option value="deadline">Deadline</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['critical', 'high', 'normal'] as Priority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setDraft({ ...draft, priority: p })}
                          className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold capitalize transition ${draft.priority === p ? (p === 'critical' ? 'border-red-500 bg-red-100 text-red-900 ring-2 ring-red-400/50' : p === 'high' ? 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400/50' : 'border-stone-400 bg-stone-200 text-stone-800 ring-2 ring-stone-400/40') : 'border-line bg-paper text-ink-soft'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <textarea className="field min-h-[60px] text-[12px]" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} aria-label="Summary" />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-paper/60 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-[1.02rem] font-semibold leading-snug text-ink">{draft.title}</h3>
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-amber-950">
                        {CATEGORY_META[draft.category] && (() => { const Icon = CATEGORY_META[draft.category].icon; return <Icon size={13} strokeWidth={2.2} />; })()}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-medium text-ink-soft">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={11} className="text-primary" />{draft.date ? new Date(draft.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'No date'}</span>
                      {draft.time && <span className="inline-flex items-center gap-1"><Clock size={11} className="text-primary" />{draft.time}{draft.endTime ? `–${draft.endTime}` : ''}</span>}
                      {draft.venue && <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-primary" />{draft.venue}</span>}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{draft.summary}</p>
                    {draft.actionItems.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-line pt-2">
                        {draft.actionItems.slice(0, 4).map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-ink">
                            <ListChecks size={11} className="mt-0.5 shrink-0 text-terracotta" />{a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* actions */}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <button onClick={addToFeed} className="btn-primary flex-1 justify-center !py-3 text-[13px]">
                    <Plus size={16} strokeWidth={2.6} /> Add to my board
                  </button>
                  <button onClick={() => { setPhase('idle'); setResult(null); setDraft(null); }} className="rounded-2xl border border-line p-3 text-ink-soft transition hover:bg-paper" aria-label="Discard">
                    <RotateCcw size={17} />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
