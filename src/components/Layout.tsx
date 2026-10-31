import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { LayoutGrid, CalendarDays, Sparkles, Settings, Zap, Megaphone } from 'lucide-react';
import { useStore } from '../lib/store';
import SettingsModal from './SettingsModal';

const NAV = [
  { to: '/', label: 'Paste', icon: Zap, end: true, hint: 'Analyze a notice' },
  { to: '/board', label: 'Board', icon: LayoutGrid, end: false, hint: 'Your saved campus cards' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false, hint: 'Notices on a month grid' },
  { to: '/digest', label: 'Digest', icon: Sparkles, end: false, hint: 'What matters this week' },
];

export default function Layout() {
  const { counts } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const needsAttention = counts.today + counts.overdue;

  return (
    <div className="flex min-h-screen flex-col text-ink">
      {/* ---------- urgency ticker ---------- */}
      <div className="relative z-40 flex items-center overflow-hidden bg-primary-deep text-[#FAF4E9]">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 bg-primary-deep px-3 py-1.5 sm:px-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-amber-400" />
          </span>
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400">Live</span>
        </div>
        <div className="marquee-mask flex-1 overflow-hidden py-1.5">
          <div className="marquee-track whitespace-nowrap text-[11px] font-medium tracking-wide">
            {[0, 1].map((n) => (
              <span key={n} className="flex items-center">
                <span className="mx-6">{counts.today} happening today</span>
                <span className="mx-6 text-amber-300">{counts.overdue} overdue deadline{counts.overdue === 1 ? '' : 's'}</span>
                <span className="mx-6">{counts.week} in your week</span>
                <span className="mx-6 text-amber-300">{counts.critical} critical</span>
                <span className="mx-6">Campus Pulse · one clear place for campus life</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
          <NavLink to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm transition-transform duration-300 group-hover:rotate-3">
              <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
                <path d="M10 36h10l5-14 7 22 6-16 4 8h12" stroke="#F0A500" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[1.15rem] font-bold tracking-tight text-primary-deep">Campus Pulse</span>
              <span className="hidden font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-ink-faint sm:block">Notice intelligence</span>
            </span>
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 rounded-full border border-line bg-card p-1 card-shadow-sm md:flex">
            {NAV.map(({ to, label, icon: Icon, end, hint }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={hint}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-[0.8rem] font-semibold transition-all duration-200 ${
                    isActive ? 'bg-primary text-[#FAF4E9] shadow-sm' : 'text-ink-soft hover:bg-primary-soft hover:text-primary'
                  }`
                }
              >
                <Icon size={14} strokeWidth={2.2} />
                {label}
                {to === '/board' && needsAttention > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-amber-950">
                    {needsAttention}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings & API key"
            className="ml-auto shrink-0 rounded-full border border-line bg-card p-2.5 text-ink-soft card-shadow-sm transition hover:rotate-45 hover:border-primary hover:text-primary md:ml-0"
          >
            <Settings size={18} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {/* ---------- page ---------- */}
      <main className="mx-auto w-full max-w-7xl flex-1 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* ---------- footer ---------- */}
      <footer className="hidden border-t border-line bg-[#F3EDE0] md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 text-[11px] text-ink-soft">
          <div className="flex items-center gap-2">
            <Megaphone size={13} className="text-primary" />
            <span><strong className="font-semibold text-ink">Campus Pulse</strong> — built for the hostel notice board generation.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Paste the chaos. Get a card.</span>
            <span className="text-line-strong">|</span>
            <span>On-device NLP · optional AI via your own key</span>
          </div>
        </div>
      </footer>

      {/* ---------- mobile bottom bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ to, label, icon: Icon, end, hint }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={hint}
              aria-label={`${label} — ${hint}`}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 ${isActive ? 'text-primary' : 'text-ink-faint'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`relative rounded-xl p-1 ${isActive ? 'bg-primary-soft' : ''}`}>
                    <Icon size={19} strokeWidth={2} />
                    {to === '/board' && needsAttention > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8.5px] font-bold text-white">
                        {needsAttention}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
