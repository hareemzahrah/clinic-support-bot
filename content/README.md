# Demo content — Ashfield Dental Practice

> ⚠️ **Do not index this file.** The ingestion glob must be `content/0*.md` — numbered documents only.
>
> This README lists every deliberate gap in the corpus. If it gets embedded, the bot can retrieve a chunk telling it exactly what it isn't supposed to know, and the adversarial test set becomes meaningless without failing loudly. Enforce the glob in code, not by remembering.

**Ashfield Dental Practice is fictional.** Every document in this folder was written for this project. No real practice's content has been copied.

## Why not scrape a real clinic

The original plan said "pull their actual FAQ pages." I researched four real UK practices to learn what documents clinics actually publish, how they word their policies, and what patients phone in to ask — then wrote an original composite from that research. Three reasons:

1. **Legal.** Republishing a real practice's pricing and policies on a public demo, without permission, invites a takedown request. That is not a conversation worth inviting.
2. **Accuracy.** Scraped prices go stale. A demo quoting a real clinic's 2026 fees incorrectly is worse than one quoting a fictional clinic's fees correctly.
3. **Control.** Some questions must have no answer in the corpus, or the refusal test is meaningless. You cannot design those gaps into content you scraped.

The realism that matters comes from the **questions being real** and the content having real depth and structure. Both are true here.

When a client asks "can it work with my content?", the answer is that you re-index and it takes ten minutes. That is a better answer than "I used your competitor's website."

## Market

UK practice, deliberately. The NHS/private split gives the corpus genuinely ambiguous questions ("is my check-up covered?") that separate good retrieval from bad — a US-only clinic would be flatter. US clients evaluating you care that it works, not which country the demo clinic is in.

## The documents

| File | Covers |
|---|---|
| `01-services-and-treatments.md` | What the practice does and does not offer |
| `02-fee-guide.md` | Private fees by treatment |
| `03-nhs-and-private.md` | NHS bands, eligibility, the split |
| `04-insurance-and-payment.md` | Accepted insurers, payment plans, finance |
| `05-appointments-and-policies.md` | Booking, cancellation, late arrival, no-show fees |
| `06-practice-information.md` | Hours, location, parking, accessibility |
| `07-treatment-aftercare.md` | Before and after treatment instructions |
| `08-new-patients-and-emergencies.md` | Registration, first visit, urgent care |

Roughly 5,500 words total — enough that retrieval genuinely has to work rather than stuffing everything into one prompt.

## Deliberate gaps

The corpus intentionally says nothing about: sedation dentistry, clinician biographies or qualifications, facial aesthetics, same-day crowns, minimum patient age, hearing loops, assistance-dog policy, cryptocurrency payment, recruitment, NHS waiting times, or anaesthetic types.

These gaps are the adversarial test set. Do not fill them in — if you add content here, update `test-sets/adversarial-set.md` to match.

## Deployment note

The live demo must carry a visible line in the widget footer: *"Demo practice. Ashfield Dental is fictional and this is a portfolio demonstration."* A visitor should never be able to mistake this for a real business.
