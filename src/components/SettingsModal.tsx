import { AnimatePresence, motion } from 'framer-motion';
import { X, KeyRound, Database, Trash2, RotateCcw, ShieldCheck, ExternalLink, Bookmark } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from './Toast';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apiKey, setApiKey, clearAll, restoreSeeds, savedRaws, removeSavedRaw, items } = useStore();
  const { toast } = useToast();
  const [keyDraft, setKeyDraft] = useState('');

  const saveKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    if (!/^[A-Za-z0-9_\-.]{10,260}$/.test(k)) {
      toast('That key looks malformed — expected sk-… with no spaces');
      return;
    }
    setApiKey(k); // the store owns persistence (JSON-encoded, validated on load)
    setKeyDraft('');
    toast('AI key saved — notices will now use GPT-4o mini');
  };

  const removeKey = () => {
    setApiKey(null);
    toast('AI key removed — on-device engine active');
  };

  const storageUsed = (() => {
    let bytes = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; bytes += k.length + (localStorage.getItem(k)?.length ?? 0); } } catch { /* ignore */ }
    return (bytes / 1024).toFixed(1);
  })();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-primary-deep/55 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-paper shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-6 py-4 backdrop-blur">
              <h2 className="font-display text-lg font-bold text-primary-deep">Settings</h2>
              <button onClick={onClose} className="rounded-full border border-line p-2 text-ink-soft transition hover:bg-primary-soft hover:text-primary" aria-label="Close settings">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-6 p-6">
              {/* ---- BYO AI key ---- */}
              <section className="rounded-2xl border border-line bg-card p-4 card-shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-lg bg-violet-100 p-1.5 text-violet-800"><KeyRound size={16} /></span>
                  <h3 className="font-display text-sm font-bold text-ink">AI extraction (optional)</h3>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">
                  Campus Pulse works 100% offline with its on-device NLP engine. For even smarter parsing, add your own
                  OpenAI key — stored only in this browser, never sent anywhere except api.openai.com.
                </p>
                {apiKey ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-900">
                      <ShieldCheck size={16} /> Key active · GPT-4o mini
                    </div>
                    <button onClick={removeKey} className="text-[11px] font-semibold text-red-800 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="field"
                      placeholder="sk-..."
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                      aria-label="OpenAI API key"
                    />
                    <button onClick={saveKey} className="btn-primary shrink-0 !px-4 !py-2 text-xs">Save</button>
                  </div>
                )}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-faint hover:text-primary">
                  Get a key from platform.openai.com <ExternalLink size={10} />
                </a>
              </section>

              {/* ---- data ---- */}
              <section className="rounded-2xl border border-line bg-card p-4 card-shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-lg bg-amber-100 p-1.5 text-amber-800"><Database size={16} /></span>
                  <h3 className="font-display text-sm font-bold text-ink">Your data</h3>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">
                  Everything lives in your browser — {items.length} notice{items.length === 1 ? '' : 's'}, about {storageUsed} KB. Nothing is uploaded.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={restoreSeeds} className="btn-ghost !px-4 !py-2 text-xs"><RotateCcw size={13} /> Reset demo feed</button>
                  <button onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-4 py-2 font-display text-xs font-semibold text-red-800 transition hover:bg-red-100">
                    <Trash2 size={13} /> Clear all notices
                  </button>
                </div>
              </section>

              {/* ---- saved raws ---- */}
              <section className="rounded-2xl border border-line bg-card p-4 card-shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800"><Bookmark size={16} /></span>
                  <h3 className="font-display text-sm font-bold text-ink">Saved raw notices ({savedRaws.length})</h3>
                </div>
                <p className="mb-2 text-[12px] text-ink-soft">Clips you bookmarked in the Paste studio. Tap to re-load into the analyzer.</p>
                {savedRaws.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-center text-[11px] text-ink-faint">Nothing saved yet. Paste a notice, analyze it, hit "Save raw".</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {savedRaws.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-2 rounded-xl border border-line bg-paper p-2.5">
                        <p className="line-clamp-3 font-mono text-[10px] leading-relaxed text-ink-soft">{r.text}</p>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('campuspulse:load-raw', { detail: r.text }));
                              toast('Loaded into the Paste studio');
                              onClose();
                            }}
                            className="rounded-full border border-line px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-ink-soft transition hover:border-primary hover:text-primary"
                          >
                            Load
                          </button>
                          <button onClick={() => removeSavedRaw(r.id)} className="rounded-full p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-700" aria-label="Remove saved notice">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-center text-[10px] leading-relaxed text-ink-faint">
                Campus Pulse v1.1 — your data stays on this device<br />On-device NLP by default · AI only with your own key
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
