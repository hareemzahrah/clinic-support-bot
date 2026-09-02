-- ---------------------------------------------------------------------------
-- Appointment request details on leads
-- ---------------------------------------------------------------------------
--
-- The widget cannot book. Booking means writing into whatever practice management system the
-- clinic runs -- Dentally, SOE Exact, Carestream, sometimes a paper diary -- and there is no
-- generic way to do that. Pretending to book would be worse than not offering it: a demo that
-- collapses the moment a client asks "does it really book?".
--
-- What it can do honestly is take a request. Preferred day, rough time, and whether it is
-- urgent, attached to the contact details the practice already receives. Someone at the
-- practice still books it, but they open the conversation knowing what to offer.
--
-- Nullable throughout, because most leads are still plain "please call me back" and forcing a
-- date on those would cost completions for no gain.

alter table leads add column if not exists preferred_day  text;
alter table leads add column if not exists preferred_time text;
alter table leads add column if not exists is_urgent      boolean not null default false;

comment on column leads.preferred_day is
  'Free text as the visitor typed it -- "next Tuesday", "any weekday morning". Deliberately not
   a date: parsing loose human phrasing into a timestamp fails in ways that lose the enquiry,
   and a human reads this before acting on it anyway.';

comment on column leads.is_urgent is
  'Visitor said it was urgent. Sorts these to the top of the dashboard -- a practice should see
   someone in pain before someone asking about whitening.';

create index if not exists leads_urgent_idx on leads(is_urgent, created_at desc)
  where is_urgent = true;
