-- Clinic Support Bot — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  source_type   text not null check (source_type in ('file', 'url', 'text')),
  source_ref    text,
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column documents.source_ref is
  'Original filename or URL. Informational only — not used for retrieval.';
comment on column documents.error_message is
  'Why ingestion failed. Surfaced in the admin dashboard so a failed PDF is visible rather than silent.';

-- ---------------------------------------------------------------------------
-- chunks
-- ---------------------------------------------------------------------------

create table if not exists chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  chunk_index  int  not null,
  heading_path text,
  content      text not null,
  token_count  int  not null,
  embedding    vector(1024),
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

comment on column chunks.heading_path is
  'Breadcrumb such as "Private Fee Guide > Crowns, bridges and dentures", prepended to the
   embedded text. Without it a chunk of a price table is a meaningless list of numbers.';
comment on column chunks.embedding is
  'voyage-3-large at its default 1024 dimensions. Changing embedding model means changing
   this dimension and re-indexing every document.';

-- Cosine distance, matching the <=> operator used in match_chunks below.
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

create index if not exists chunks_document_id_idx on chunks(document_id);

-- ---------------------------------------------------------------------------
-- conversations and messages
-- ---------------------------------------------------------------------------

create table if not exists conversations (
  id             uuid primary key default gen_random_uuid(),
  session_id     text not null,
  started_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  message_count  int not null default 0
);

create index if not exists conversations_session_id_idx on conversations(session_id);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  cited_chunk_ids uuid[],
  was_answered    boolean,
  created_at      timestamptz not null default now()
);

comment on column messages.was_answered is
  'False when the model refused or retrieval returned nothing above threshold. Null on user
   messages. The entire gaps dashboard is built on this one column.';

create index if not exists messages_conversation_id_idx on messages(conversation_id);

-- Partial index: the gaps dashboard only ever queries unanswered messages.
create index if not exists messages_unanswered_idx
  on messages(created_at desc) where was_answered = false;

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  name            text,
  email           text,
  phone           text,
  reason          text,
  created_at      timestamptz not null default now()
);

comment on column leads.reason is
  'Why capture triggered: refused, no_context, asked_for_human.';

create index if not exists leads_created_at_idx on leads(created_at desc);

-- ---------------------------------------------------------------------------
-- rate_limits
-- ---------------------------------------------------------------------------

create table if not exists rate_limits (
  ip_hash       text not null,
  day           date not null,
  message_count int  not null default 0,
  primary key (ip_hash, day)
);

comment on table rate_limits is
  'IPs are stored hashed, never raw, and pruned after 7 days. The clinic has no reason to hold
   visitor IP addresses.';

-- ---------------------------------------------------------------------------
-- Vector search
-- ---------------------------------------------------------------------------

create or replace function match_chunks(
  query_embedding vector(1024),
  match_threshold float,
  match_count     int
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  heading_path   text,
  content        text,
  similarity     float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    d.title as document_title,
    c.heading_path,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where d.status = 'ready'
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

comment on function match_chunks is
  'Returns chunks above the similarity threshold, closest first. Returning zero rows is a
   designed outcome, not an error — the caller must skip the model entirely and take the
   "I do not know" path.';

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

create or replace function increment_rate_limit(
  p_ip_hash text,
  p_limit   int
)
returns boolean
language plpgsql
as $$
declare
  new_count int;
begin
  insert into rate_limits (ip_hash, day, message_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set message_count = rate_limits.message_count + 1
  returning message_count into new_count;

  return new_count <= p_limit;
end;
$$;

comment on function increment_rate_limit is
  'Atomically increments and tests in one statement. Returns true if the request is allowed.
   Doing this as a separate read-then-write would race under concurrent requests.';

create or replace function prune_rate_limits()
returns void
language sql
as $$
  delete from rate_limits where day < current_date - interval '7 days';
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every table is locked down with RLS enabled and NO policies granted. That means the
-- anon and authenticated keys can read nothing at all. Only the service_role key, used
-- exclusively in server-side API routes, bypasses RLS.
--
-- This matters: the widget is embedded on public websites, so the browser must never hold
-- a key that can read the leads table.

alter table documents     enable row level security;
alter table chunks        enable row level security;
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table leads         enable row level security;
alter table rate_limits   enable row level security;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on documents;
create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Data API grants
-- ---------------------------------------------------------------------------
--
-- Required when the project has "Automatically expose new tables" turned OFF,
-- which is Supabase's own recommendation and what this project uses. With that
-- setting off, a new table is invisible to the Data API (PostgREST) until it is
-- explicitly granted -- including to service_role, which is what our server
-- code authenticates as. Without these grants `npm run seed` fails on a
-- permissions error.
--
-- These statements are harmless if the setting is left ON, so the migration
-- works either way.
--
-- The shape is deliberate: service_role gets everything, anon and authenticated
-- get nothing. That is belt and braces alongside RLS. RLS already blocks anon
-- because no policies exist, but a revoked grant means that even if someone
-- later disables RLS on a table by mistake, the public keys still cannot read
-- it. Two independent locks, not one.

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all routines  in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Apply the same rule to anything added by a future migration, so this does not
-- have to be remembered every time a table is created.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
