# Clinic Support Bot — Design

**Date:** 2026-08-31
**Author:** Hareem
**Purpose:** A customer-support AI chatbot for dental and medical clinics.

---

## 1. What we are building

An embeddable chat widget that answers a clinic's patient questions using that clinic's own documents — FAQ pages, price lists, insurance policies, opening hours, pre- and post-treatment instructions. When it cannot answer, it collects the visitor's contact details and hands off to the clinic instead of guessing.

The clinic owner gets an admin dashboard showing what patients asked, which questions went unanswered, and which visitors left contact details.

### Why a clinic

Clinics have stable, well-defined FAQs; a clear cost problem (staff answering the same twenty questions by phone all day); and a clear revenue problem (after-hours enquiries that never turn into bookings). That makes the pitch concrete: *"this answers the questions your front desk repeats forty times a day, and captures the after-hours ones you currently lose."*

### The one-line positioning

> Reduces front-desk phone load and captures after-hours enquiries that would otherwise be lost.

---

## 2. Scope

### In scope

- Document ingestion: PDF, DOCX, plain text, and single-URL page scrape
- Semantic search over ingested chunks
- Grounded answering with inline source citations
- Explicit "I don't know" behaviour when retrieval finds nothing relevant
- Lead capture (name + email or phone) on failure or on request for a human
- Admin dashboard: conversations, top questions, unanswered questions, leads
- Single-line `<script>` embed for any website
- Rate limiting and spend guardrails
- Live public demo seeded with real content from 3–4 actual clinics

### Explicitly out of scope (YAGNI)

These are deliberately cut. Several are worth naming in client conversations as paid upgrades, which is more useful than building them now.

- Multi-tenant billing or subscription plans
- Visitor-facing authentication
- Multi-language support
- Voice or phone integration
- CRM / calendar / practice-management integrations — **sell as an upgrade**
- Fine-tuning — RAG makes it unnecessary here
- Live agent chat (we capture the lead; a human replies by email)
- Analytics beyond the four dashboard views listed above

### Success criteria

1. Answers at least 80% of a held-out set of 50 real clinic questions correctly, verified by hand.
2. Refuses, rather than inventing an answer, on 100% of a 15-question adversarial set (questions whose answers are genuinely absent from the documents). **This is the hard gate — a single hallucination here means the retrieval or prompt needs work before shipping.**
3. First token appears in under 2 seconds on a typical question.
4. Widget renders correctly on mobile and on a desktop site it was not designed for.

---

## 3. Architecture

```
Visitor's browser
  └── widget.js  (embed script, renders iframe)
        └── /embed  (chat UI — Next.js route)
              └── POST /api/chat        ── streams answer
                    ├── embed question        → Voyage AI
                    ├── vector search         → Supabase pgvector
                    ├── generate grounded answer → Claude Opus 5
                    └── log turn              → Supabase

Clinic owner's browser
  └── /admin  (Supabase Auth)
        ├── /admin/documents      → upload, list, re-index, delete
        ├── /admin/conversations  → transcripts
        ├── /admin/gaps           → unanswered questions
        └── /admin/leads          → captured contacts

Ingestion (background)
  POST /api/documents → extract text → chunk → embed → store
```

### Stack

| Layer | Choice | Reason |
|---|---|---|
| App framework | Next.js (App Router) + TypeScript | One repo, one deploy, API routes and UI together |
| Chat UI | Vercel AI SDK + AI Elements | Streaming, message state, and citation rendering already solved |
| Styling | Tailwind + shadcn/ui | AI Elements is built on it; consistent by default |
| Database | Supabase Postgres | Free tier covers this; SQL is easy to explain to clients |
| Vector search | pgvector (HNSW index) | Same database as everything else — no second service |
| Embeddings | Voyage AI `voyage-4-large` | Anthropic's recommended embedding partner; Voyage's own pick for retrieval and RAG. $0.12/1M tokens against a 200M free allowance — effectively free here. *(Earlier drafts named `voyage-3-large`; it is deprecated.)* |
| Answers | Claude `claude-opus-5`, effort `low` | Best refusal behaviour, which is the core requirement |
| Auth (admin only) | Supabase Auth | Comes free with the database |
| Hosting | Vercel | Free tier, gives the public demo link |

**Why pgvector rather than Pinecone:** below roughly a million chunks Postgres handles this well, and metadata filters, permissions, and vector search happen in one query. One service instead of two is also one less thing to explain and pay for.

**Why TypeScript rather than Python:** this project's value is a polished artifact a client can click, and the whole surface — embeddable widget, admin dashboard, API routes — then lives in one language and one deployment.

---

## 4. Data model

```sql
documents      (id, title, source_type, source_ref, status, created_at)
chunks         (id, document_id → documents, content, token_count,
                embedding vector(1024), chunk_index)
conversations  (id, session_id, started_at, last_active_at)
messages       (id, conversation_id → conversations, role, content,
                cited_chunk_ids[], was_answered bool, created_at)
leads          (id, conversation_id → conversations, name, email, phone,
                reason, created_at)
rate_limits    (ip_hash, day, message_count)   -- primary key (ip_hash, day)
```

Visitor IPs are stored hashed, never raw, and rows older than 7 days are pruned. The clinic has no reason to hold visitor IP addresses, and not collecting them is one less thing to explain in a client conversation.

`messages.was_answered` is the single field the entire gaps dashboard is built on. It is set to `false` whenever the model refuses or retrieval returns nothing above the similarity threshold.

An HNSW index on `chunks.embedding` keeps retrieval fast as the document set grows.

---

## 5. Components

Each of these is a separate module with one job, so it can be tested on its own.

| Module | Does | Depends on |
|---|---|---|
| `lib/ingest/extract.ts` | File or URL → plain text | pdf-parse, mammoth, cheerio |
| `lib/ingest/chunk.ts` | Text → overlapping chunks | nothing (pure function) |
| `lib/embed.ts` | Text → vector | Voyage API |
| `lib/retrieve.ts` | Question → top-k chunks above threshold | embed, Supabase |
| `lib/answer.ts` | Question + chunks → streamed grounded answer | Claude API |
| `lib/guardrails.ts` | Rate limit, session cap, spend cap | Supabase |
| `components/chat/*` | Widget UI | AI Elements |
| `app/admin/*` | Dashboard | Supabase |

`chunk.ts` and `retrieve.ts` are pure enough to unit test without network calls, which is where most retrieval bugs actually live.

---

## 6. Key flows

### Answering a question

1. Guardrails check the IP rate limit and session message count. Over either limit → friendly refusal, no API call.
2. Embed the question via Voyage.
3. Vector search for the top 5 chunks with cosine similarity above **0.25**. *(Measured in Phase 2, not guessed — see the finding below.)*
4. **Zero chunks above threshold → skip the model entirely.** Return the "I don't know, would you like someone to get back to you?" path and set `was_answered = false`. This saves money and removes any chance of hallucination.
5. Otherwise send the chunks to Claude with a system prompt instructing it to answer only from the provided context and to say so when the context is insufficient.
6. Stream the answer back with source chips beneath it.
7. Log the turn, including which chunks were cited.

### Threshold finding (Phase 2, 2026-09-02)

The spec assumed the similarity threshold would do most of the refusal work. Profiling both
test sets against the real corpus showed it cannot:

| | |
|---|---|
| Weakest genuine hit | 0.319 |
| Strongest gap match | 0.476 |
| Separation | **-0.156** |

The sets overlap. Any threshold that retrieves all 50 answerable questions also lets all 15
unanswerable ones pull back plausible content — the sedation question scores 0.476 against the
nervous-patients paragraph, higher than most genuine questions score against their own source.

Two consequences:

1. **The threshold is set to 0.25** — below the genuine floor with margin, doing nothing more
   than discarding true nonsense. 50/50 retrieval.
2. **The grounding prompt carries the refusals.** This is where Phase 2b effort goes. The
   zero-chunk short-circuit still exists but will rarely fire, so it is a backstop rather than
   the primary mechanism the spec assumed.

Retrieval itself is not the risk here — it scores 100%. The risk is entirely in whether the
model declines to use context that looks relevant and is not.

### Capturing a lead

Triggered when the model refuses, retrieval finds nothing, or the visitor asks for a human. The bot offers to take a name and an email or phone number, writes a `leads` row, and confirms. It never asks for anything beyond name and one contact method.

### Ingesting a document

Upload → extract text → chunk to roughly 500 tokens with 15% overlap → embed in batches → store. Document status moves `pending → processing → ready` or `failed`, and the dashboard shows this so a failed PDF is visible rather than silent.

**Seeding the demo corpus uses the glob `content/0*.md` — numbered files only.** `content/README.md` documents the corpus's deliberate gaps; indexing it would let the bot retrieve its own answer key and quietly invalidate the adversarial test set. Enforce the glob in the seed script rather than relying on anyone remembering.

---

## 7. Error handling

| Failure | Behaviour |
|---|---|
| Voyage API down | Show "having trouble right now", log, offer lead capture |
| Claude API down or rate limited | Same, with retry and backoff first |
| Claude returns `stop_reason: "refusal"` | Treat as unanswered, offer lead capture |
| PDF unparseable | Mark document `failed` with a visible reason in the dashboard |
| No chunks above threshold | Not an error — the designed "I don't know" path |
| Rate limit hit | Friendly message with a reset time; no API call made |

The principle: every failure degrades into lead capture. A visitor whose question failed should still leave their details, so a broken moment still produces value for the clinic. That is worth saying out loud in client conversations.

---

## 8. Testing

- **Unit:** chunking boundaries and overlap; the threshold logic in `retrieve.ts`; guardrail counters.
- **Retrieval set:** 50 real clinic questions with the expected source document for each. Run after any change to chunking, embedding, or the threshold. Track the hit rate as a single number.
- **Adversarial set:** 15 questions with no answer in the documents. Every one must refuse. This gates release.
- **Manual:** widget on mobile Safari, on Chrome desktop, and embedded in a plain HTML page that knows nothing about the project.

The two question sets are the most valuable artifact in the repo. They are what let you claim a specific accuracy number in the README rather than a vague "works well".

---

## 9. Cost and guardrails

Estimated at roughly 3,500 input and 350 output tokens per message.

| | Opus 5 |
|---|---|
| Per message | ~2.5¢ |
| Build phase (~400 test messages) | ~$10 |
| Typical demo month (~50 messages) | ~$1.50 |
| First 3 months, all in | **~$15–20** |

Embeddings stay under $0.20 total. Supabase and Vercel free tiers cover the rest.

Guardrails, built in Phase 1 rather than bolted on later:

1. 20 messages per IP per day
2. 15 messages per session
3. `max_tokens: 500`
4. A hard monthly spend cap configured in the Anthropic console
5. Effort set to `low` on the answer route — FAQ lookup does not need deep reasoning, and thinking tokens bill as output

Actual per-message cost gets measured on a real batch in Phase 2 rather than trusted from this estimate.

---

## 10. Build phases

| Phase | Deliverable | Rough time |
|---|---|---|
| 0 | Real content gathered from 3–4 clinics; 50-question and 15-question test sets written | 1 day |
| 1 | Ingestion pipeline: file → chunks → embeddings in Supabase. Guardrails table. | 3 days |
| 2 | Retrieval + grounded answering, working from the command line. Threshold tuned against the test sets. | 3 days |
| 3 | Chat UI with streaming and citations | 3 days |
| 4 | Lead capture and handoff | 2 days |
| 5 | Admin dashboard (documents, conversations, gaps, leads) | 4 days |
| 6 | Embed script, deploy, README case study, Loom video | 2 days |

Phases 1 and 2 ship without any UI on purpose. If retrieval is weak, a polished interface only makes weak answers look confident — and that is the failure mode a client will catch in the demo.

---

## 11. Deliverables

The code is half the project. These are the other half:

- **Live demo link**, seeded with realistic clinic content
- **Walkthrough video, 60–90 seconds:** ask a normal question, ask an unanswerable one to show the refusal, capture a lead, then show the gaps dashboard. That sequence is the whole pitch.
- **README as case study:** problem → approach → screenshots → the measured accuracy number from the test set
- **Honest framing:** self-initiated, built on researched public clinic content, with the demo practice clearly labelled as fictional.

---

## 12. Open questions

- Which 3–4 clinics to source content from — resolved in Phase 0.
- Whether the similarity threshold of 0.35 holds up. Expect to tune it; the test set decides.
- Whether Haiku 4.5 matches Opus 5 on the adversarial refusal set. Worth benchmarking in Phase 2 — if it holds, running cost drops roughly fivefold. If it does not, stay on Opus 5.
