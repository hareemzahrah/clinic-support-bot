# Clinic Support Bot

An embeddable AI assistant that answers a dental practice's patient questions from that
practice's own documents — with source citations, an explicit "I don't know" when the answer
isn't in the documents, and lead capture when a human is needed.

**Status: Phase 1 of 7 — ingestion pipeline.** No chat interface yet; that is Phase 3.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

Create a free project at [supabase.com](https://supabase.com). Then:

1. Open the SQL editor and run [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql).
2. Copy `.env.example` to `.env.local`.
3. From Project Settings → API, copy the project URL into `SUPABASE_URL` and the
   **service role** key into `SUPABASE_SERVICE_ROLE_KEY`.

The service role key bypasses Row Level Security and is used only in server-side code. Every
table has RLS enabled with no policies granted, so the anon key can read nothing at all —
which is what makes it safe to embed this widget on a public website.

### 3. Voyage AI

Create a key at [dashboard.voyageai.com](https://dashboard.voyageai.com) and put it in
`VOYAGE_API_KEY`. Current models include 200 million free tokens; this corpus uses about
8,000, so embeddings are effectively free.

### 4. Index the corpus

```bash
npm run seed
```

---

## Commands

| Command | Does |
|---|---|
| `npm run seed:dry` | Chunk the corpus and print statistics. **No API keys needed.** |
| `npm run seed:dry:verbose` | The same, plus every chunk's heading path and size |
| `npm run seed` | Chunk, embed and store the corpus |
| `npm test` | Run the test suite |
| `npm run typecheck` | TypeScript, no emit |
| `npm run dev` | Next.js dev server |

`seed:dry` is the fast loop while tuning chunking — it costs nothing and needs no credentials.
Re-running `npm run seed` replaces existing documents rather than duplicating them.

---

## How ingestion works

```
source ──► extract ──► chunk ──► embed ──► store
 file      plain text   ~500tok  1024-dim   Postgres
 or URL                 + heading  vector   + pgvector
```

**Chunking is markdown-aware, and that is the load-bearing decision.** Splitting at fixed
character offsets would cut the fee guide's tables mid-row, producing chunks like
`| Porcelain crown | £780 |` with no header and no heading — a string of tokens that embeds
as noise and retrieves for nothing.

Instead, chunks split on headings, tables stay intact (and repeat their header row if a table
must be split), and every chunk carries a breadcrumb:

```
Private Fee Guide > Crowns, bridges and dentures

| Treatment | Fee |
|---|---|
| Porcelain crown | £780 |
...
```

That breadcrumb is both embedded and passed to the model, so a retrieved price always arrives
with the knowledge of what it prices.

A document is only marked `ready` once every chunk is stored. Retrieval filters on that
status, so a document that fails halfway through is invisible rather than partially visible —
a half-indexed fee guide would answer some price questions and silently miss others.

---

## Layout

```
content/           Demo corpus — 8 documents. See content/README.md.
test-sets/         50 retrieval questions, 15 adversarial. The release gate.
supabase/          SQL schema
scripts/seed.ts    Corpus indexer
src/lib/
  embed.ts         Voyage embeddings
  supabase.ts      Service-role client (server only)
  ingest/
    chunk.ts       Markdown-aware chunking
    extract.ts     PDF / DOCX / MD / URL -> text
    index.ts       Orchestrator
docs/superpowers/specs/   Design spec
```

---

## A note on the demo content

Ashfield Dental Practice is fictional. The corpus was written for this project after
researching real UK practices — not scraped from any of them. The reasoning, including why
that produces a *better* portfolio piece rather than a weaker one, is in
[`content/README.md`](content/README.md).
