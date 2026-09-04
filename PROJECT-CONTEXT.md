# Project context — read this first

Written for anyone picking this project up cold. It covers what the project is, which
decisions were reached by measurement, and which things will break if changed without
understanding why they are the way they are.

**Built by Hareem.**

---

## What it is

A customer-support chatbot for dental practices. It answers patient questions from the practice's
own documents and, when the answer is not in them, says so and captures the patient's details
instead of inventing something.

- **Live:** https://clinic-support-bot.vercel.app
- **Repo:** https://github.com/hareemzahrah/clinic-support-bot
- **Dashboard:** /login → "Sign in to the demo" (`demo@ashfielddental.example` / `ashfield-demo-2026`)

Stack: Next.js 16 (App Router) · TypeScript · Supabase Postgres + pgvector · Voyage AI embeddings
· Claude (`claude-opus-5` answering, `claude-haiku-4-5` classifying) · Vercel.

## Current state

All six planned phases are complete and deployed. 40+ commits. 49 unit tests. Production build
passes. The Vercel cron keeps Supabase awake.

| | |
|---|---|
| Answerable questions correct | 50 / 50 |
| Unanswerable refused | 15 / 15 |
| Unsupported claims | 0 / 65 |
| Cost per message | ~$0.0088 |

## Decisions reached by measurement — do not quietly reverse these

**The similarity threshold cannot carry the refusals.** The original design assumed a cutoff
would separate answerable questions from gaps. Profiling both test sets against the real corpus
showed the opposite:

```
weakest genuine hit    0.319
strongest gap match    0.476   ("do you offer sedation?" against the nervous-patients passage)
separation            -0.156
```

The distributions overlap. Any threshold catching all 50 answerable questions also lets all 15
unanswerable ones retrieve plausible content. So the threshold sits at **0.25**, does nothing but
discard nonsense, and the grounding prompt in `src/lib/answer.ts` carries every refusal. Re-run
`npm run tune` before touching this.

**Answer generation and answer assessment are separate calls.** The answering model originally
self-reported whether it had answered. Its replies were correct every time; its self-assessment
was wrong on roughly one borderline turn in five — it would decline, offer genuinely useful
related information, then mark the turn answered because the reply felt helpful. `src/lib/classify.ts`
now judges with a small model that has nothing to defend. Do not merge these back together.

**The release gate measures grounding, not flag accuracy.** The first gate was "did it flag this
turn correctly", and it kept moving: tighten the rule and correct answers got flagged as gaps,
loosen it and gaps slipped through. Failures migrated between questions rather than disappearing
— the signature of forcing a fuzzy judgement into pass/fail. Whether *"I can't diagnose that, but
ring us the same day"* answers *"do I need a root canal"* has no crisp answer. Whether a reply
claims something the documents do not support does. `src/lib/grounding.ts` is the gate; the
answered/unanswered flag is reported as a quality percentage.

**Retrieving nothing still calls the model.** It used to short-circuit to a fixed "I don't have
that information" line. Free, but it meant someone opening with "hey" was told the practice had
no information about hello.

**The widget takes appointment *requests*, not bookings.** Booking means writing into whatever
practice management system a clinic runs. A mocked booking flow collapses the moment someone asks
whether it really books.

---

## Things that will silently break

**`content/README.md` must never be indexed.** It documents the corpus's deliberate gaps. Index
it and the assistant can retrieve its own answer key, invalidating the adversarial suite without
failing loudly. The seed glob is pinned to `content/0*.md`.

**The corpus gaps are deliberate.** It says nothing about sedation, clinician biographies, facial
aesthetics, hearing loops, assistance dogs, home visits, retainer wear duration, mouthguards,
student discounts or NHS waiting times. Those absences *are* `test-sets/adversarial-set.md`.
Filling one in means updating that file to match.

**Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The old filename silently does nothing —
the deprecation notice appears only in the dev server log. When this bit, `/admin` returned 200
to anyone. A security control failing open, quietly.

**Percentage heights need a parent with a definite height.** A chart column without `h-full`
collapses every bar to nothing and renders empty with no error. This has happened once already.

**Server-only and browser code must stay in separate modules.** `supabase-auth.ts` imports
`next/headers`; `supabase-browser.ts` does not. Combining them drags server code into the client
bundle and fails with a misleading "you are using it in the Pages Router" error.

**The demo seed data's *shape* matters.** A first pass gave every answered question one ask and
repeated only the gaps, producing a headline of "39% answered instantly" — a demo arguing against
the product. Weights in `scripts/seed-demo-data.ts` now model real support traffic: a few dull
questions asked constantly, a long tail of gaps, and day-to-day variance so the chart is not flat.

---

## Commands

```bash
npm run dev                # local server (not running by default; it is not a service)
npm run build              # production build — run before deploying anything
npm test                   # 49 unit tests, no API calls, free

npm run check:db           # verify schema and keys before spending anything
npm run check:llm          # verify the Anthropic key with one minimal call
npm run seed               # index content/0*.md into pgvector
npm run seed:demo:reset    # rebuild the dashboard's demo history (free, no API calls)
npm run create:demo-user   # create or reset the dashboard demo login

npm run tune               # profile both test sets — run before touching the threshold
npm run test:adversarial   # the gate, ~15 questions, ~$0.13
npm run test:answers       # full suite with grounding check, ~$1.00
```

Scripts read `.env.local` and talk to Supabase directly, so they work against production from a
local machine without redeploying.

## Layout

```
content/              8 corpus documents (0*.md) + a README that must not be indexed
test-sets/            the two evaluation suites, written before the code
supabase/migrations/  run in order in the Supabase SQL editor
src/lib/              retrieve · answer · classify · grounding · guardrails · dashboard
src/app/              site · /how-it-works · /login · /admin · /embed · api routes
public/widget.js      the embeddable script — shadow DOM + iframe isolation
LOOM-SCRIPT.md        90-second demo script
DEPLOY.md             deployment and pre-launch checklist
```

## Design

Palette and type come from a Stitch export ("Obsidian Dental") — dark, violet `#8b5cf6` call to
action, Manrope display, Inter body, JetBrains Mono labels. Material-style role tokens
(`surface` / `on-surface` / `primary-container`) kept with the exported names so the design and
the code do not drift. The dashboard is modelled on Plausible: one page, no navigation, a stat
strip, an area chart with a real Y-axis, and list rows with a proportional block behind them.

Images live in `public/img/` rather than the Google CDN links Stitch emitted, which are
temporary.
