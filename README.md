# Campus Pulse

One clear pulse on campus life. Paste a messy forwarded notice — WhatsApp chaos, hostel emails, poster captions — and Campus Pulse turns it into a structured, actionable card: title, date, time, venue, category, urgency, summary and action items.

## Quick start

```bash
npm install
npm run dev        # dev server
npm run build      # production build (tsc + vite)
npm test           # vitest regression suite (src/lib/nlp.test.ts)
npm run lint       # eslint
```

Open the app — it ships with a seeded, realistic campus feed dated relative to today (replace it freely; it is labelled "Demo" on each card and cleared via Settings → Reset demo feed).

## What you get

| Screen | Purpose |
| --- | --- |
| **Paste** (home) | Analyze a notice. On-device NLP by default; your text never leaves the browser. |
| **Board** | Everything you've tamed, grouped Today / Overdue / Upcoming / Expired, searchable and filterable. |
| **Calendar** | Month grid, category-colored dots, tap a day for its cards. |
| **Digest** | "What do I need to know this week?" — an on-device digest, or a validated GPT-4o-mini digest when you add your key. |

## AI extraction (optional)

Campus Pulse works 100% offline with its on-device parser. For AI-grade extraction, add your own OpenAI key in **Settings → AI extraction**. The key:

- is stored only in your browser's `localStorage` (JSON-encoded, validated on load),
- is sent only to `https://api.openai.com/v1/chat/completions`,
- is never exposed to any other origin, analytics, or logging.

Or set `VITE_OPENAI_API_KEY` in a `.env` file for a build-time default. AI calls have a **10s timeout**, **strict field-by-field validation** of the model's JSON (invalid fields are discarded, never trusted), **cancellation** support, and a **labelled on-device fallback** when AI is unreachable. The weekly digest likewise upgrades to a validated GPT-4o-mini version (15s timeout) with clear "Fallback" labelling when unavailable. No fabricated confidence scores — the UI reports the actual engine and extraction outcome.

## Data & privacy

- All notices, filters and saved clips live in `localStorage` — nothing is uploaded, ever.
- Keys are loaded with validation; a corrupted entry falls back safely instead of crashing the app.
- Deleting a card or clearing the board never requires an account.

## Scripts

- `npm run build` — type-check (`tsc -b`) + production bundle
- `npm test` — focused regression suite covering date/time parsing, ranges, explicit years, lifecycle detection, AI-response validation, dedupe fingerprints, status/urgency boundaries, weekly boundaries and ICS/Google-export escaping
- `npm run preview` — serve the production build locally

## Tech

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router (hash-based) · Framer Motion · Lucide icons. No backend required.
