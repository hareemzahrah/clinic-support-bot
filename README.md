# Clinic Support Assistant

A customer-support chatbot for dental practices that answers patient questions from the
practice's own documents — and, when the answer isn't in them, says so and takes the patient's
details instead of inventing something.

**[Live demo](https://clinic-support-bot.vercel.app)** · **[How it works](https://clinic-support-bot.vercel.app/how-it-works)** · **[Practice dashboard](https://clinic-support-bot.vercel.app/login)** (`demo@ashfielddental.example` / `ashfield-demo-2026`)

Open the chat and ask *"how much is a check-up?"* — then ask *"do you offer sedation for nervous patients?"*, which the practice's documents do not answer.

| | |
|---|---|
| Answerable questions handled correctly | **50 / 50** |
| Unanswerable questions refused | **15 / 15** |
| Replies making an unsupported claim | **0 / 65** |
| Cost per message | **$0.0088** |
| Median first-token latency | under 2s |

---

## The problem this actually solves

Wiring a chatbot to a set of documents is a weekend's work. The difficulty is what happens when
someone asks a question the documents don't answer — because similarity search *will* return
something, and it will look relevant.

This corpus has a warm paragraph about looking after nervous patients. It says nothing about
sedation. Ask **"do you offer sedation?"** and that paragraph comes back scoring **0.476** —
higher than most genuine questions score against their own source document. A real question
about cancellation notice scores **0.319**.

```
weakest genuine hit    0.319
strongest gap match    0.476
separation            -0.156
```

The sets overlap. **No similarity threshold separates them**, so the design assumption that a
cutoff could carry the refusals was wrong. I measured this rather than assumed it, and the
measurement moved the work: the threshold now does nothing but discard nonsense, and the
grounding prompt carries every refusal.

That is the whole project. Everything else is plumbing.

## How it works

```
Visitor's browser
  └── widget.js — one script tag, shadow DOM, iframe
        └── POST /api/chat  (Server-Sent Events)
              ├── guardrails      rate limit + session cap, before anything billable
              ├── embed question  Voyage AI
              ├── vector search   Postgres + pgvector, cosine, top 5 above 0.25
              ├── ground + answer Claude, streamed
              ├── classify        Haiku decides whether the documents answered it
              └── log             conversation, citations, gap flag

Practice dashboard  /admin  (Supabase Auth)
  └── volume over time, unanswered questions by frequency, captured contacts
```

**Stack** — Next.js 16 · TypeScript · Postgres + pgvector (Supabase) · Voyage AI embeddings ·
Claude · Vercel.

## Decisions worth explaining

**The grounding prompt, not the threshold, does the refusing.** Forced by the measurement above.
The prompt asks a stricter question than "is this relevant?" — it asks whether the passage states
the answer to the exact question asked. Retrieved text about nervous patients is on-topic and
still silent on sedation.

**A separate model grades the answer.** The answering model originally self-reported whether it
had answered. Its *replies* were correct every time; its *self-assessment* was wrong about one
turn in five on borderline cases. Two jobs in one call. A small model given only the question and
the reply — with nothing to defend — is a far better judge.

**The release gate measures grounding, not flag accuracy.** The first gate was "did it flag this
turn correctly", and it kept moving: tighten the rule and correct answers got flagged as gaps,
loosen it and gaps slipped through. Failures migrated between questions rather than disappearing,
which is what forcing a fuzzy judgement into pass/fail looks like. Whether *"I can't diagnose
that, but ring us the same day"* answers *"do I need a root canal"* has no crisp answer.
Whether a reply claims something the documents don't support does. So that is the gate.

**Retrieving nothing still reaches the model.** It used to short-circuit to a fixed "I don't have
that information" line — free, but it meant someone opening with "hey" was told the practice had
no information about hello.

**The widget cannot book appointments, and doesn't pretend to.** Booking means writing into
whatever practice management system a clinic runs. A mocked booking flow collapses the moment a
client asks whether it really books, and takes everything else's credibility with it. It captures
an appointment *request* instead — preferred day, time, urgency — for a human to confirm.

## Testing

Two suites, written before the code.

**`test-sets/retrieval-set.md`** — 50 questions with real answers in the documents, phrased the
way patients type them (`how much for teeth whitening`, not "what is the fee for the whitening
treatment"). A question that reuses the document's own wording tests nothing.

**`test-sets/adversarial-set.md`** — 15 questions with no answer at all. Thirteen retrieve
confident, plausible, wrong context. Two were cut after a pre-flight found they were answerable:
*"do you treat pets?"* was correctly answered from "we serve adults and children", and a student
discount question drew a good answer built from real corpus content. An ambiguous item in a
release gate is a defect.

```bash
npm test                 # 42 unit tests, no API calls
npm run tune             # profile both suites against the corpus
npm run test:adversarial # the gate, ~15 questions
npm run test:answers     # full suite with the grounding check
```

## Running it

```bash
npm install
cp .env.example .env.local     # fill in four values
npm run check:db               # verify schema and keys before spending anything
npm run seed                   # index the corpus
npm run dev
```

The migrations in `supabase/migrations/` run in order in the Supabase SQL editor.

## The demo corpus

`content/` holds eight documents for **Ashfield Dental Practice**, a fictional UK clinic. Written
from research into how real practices publish their information, not scraped — republishing a
real clinic's pricing invites a takedown request, scraped prices go stale, and you cannot design
gaps into content you did not write. Those gaps are the adversarial suite.

The site's content matches the corpus, and so do its omissions: no clinician names, no sedation,
no implants placed in house.

## What's deliberately not here

Multi-tenant billing · visitor authentication · multi-language · voice · CRM and calendar
integrations · fine-tuning · live agent chat. Several are worth quoting for as paid work rather
than building on spec.

---

Ashfield Dental Practice is fictional. Built as a portfolio project.
