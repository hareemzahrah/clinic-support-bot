# Retrieval test set — 50 questions

Every question here **has** an answer in the corpus. The bot must find it and answer correctly.

Questions are written the way patients actually phrase things — lowercase, abbreviated, occasionally imprecise — not the way the documents phrase them. That gap is the whole point. A question that reuses the document's own wording tests nothing.

## How to score

For each question, record:

- **Retrieved** — did the correct source document appear in the top 5 chunks? (yes/no)
- **Answered** — is the answer factually correct against the corpus? (yes/no)

The headline number for your README is **Answered = yes**, as a percentage of 50. Target is 80% or better before building any UI.

Score the two separately. If retrieval is 90% but answers are 65%, the problem is your prompt. If retrieval is 60%, the problem is chunking or the similarity threshold, and no prompt change will save you.

Re-run this whole set after any change to chunk size, overlap, embedding model, top-k, or the similarity threshold.

---

## Services — `01-services-and-treatments.md`

| # | Question | Answer must contain |
|---|---|---|
| 1 | do you do implants | No — referred to a specialist; restorative follow-up done here |
| 2 | can you straighten my teeth without metal braces | Yes — clear aligners, 6–18 months, mild to moderate cases |
| 3 | do you still do silver fillings | No new amalgam; existing ones repaired or replaced |
| 4 | do you take out wisdom teeth | Straightforward yes; most impacted ones referred to oral surgeon |
| 5 | can i get a root canal on a back tooth | Molars referred to a specialist endodontist |
| 6 | can you whiten my teeth in one appointment | No — home whitening only, 2–3 weeks; no in-chair power whitening |
| 7 | do you put sealants on kids teeth | Yes — fissure sealants on children's back teeth |

## Fees — `02-fee-guide.md`

| # | Question | Answer must contain |
|---|---|---|
| 8 | how much is a check up | £54 routine, £79 new patient |
| 9 | what do you charge for a filling | £135 / £175 / £225 by size |
| 10 | how much for teeth whitening | £340 both arches including trays |
| 11 | whats the cost of a porcelain crown | £780 |
| 12 | how much is the hygienist | £72 for 30 min, £98 for 45 min |
| 13 | do i pay for the aligner consultation if i go ahead | £95, deducted from treatment cost if you proceed within 3 months |
| 14 | what does an emergency appointment cost | £85 private (£27.90 NHS — see doc 08) |
| 15 | how much is a denture repair | From £95 |

## NHS and private — `03-nhs-and-private.md`

| # | Question | Answer must contain |
|---|---|---|
| 16 | are you taking nhs patients | Not new adults; children of registered adults yes; expression-of-interest list |
| 17 | how much is an nhs check up | £27.90 (Band 1) |
| 18 | do i pay for my kids dental treatment | Free under 18 |
| 19 | im pregnant is my treatment free | Yes — and for 12 months after birth |
| 20 | if i need three fillings do i pay three times | No — one Band 2 charge per course of treatment |
| 21 | can i get white fillings on the nhs | Not on back teeth — NHS provides amalgam there; white quoted privately |
| 22 | can i have some treatment on the nhs and some private | Yes — written plan showing both; never moved without agreement |

## Insurance and payment — `04-insurance-and-payment.md`

| # | Question | Answer must contain |
|---|---|---|
| 23 | do you bill my insurance directly | No — you pay, get an itemised receipt, claim it back |
| 24 | do you accept bupa | Familiar with Bupa claims; still pay and claim back |
| 25 | i have insurance with vitality can you still see me | Not on the familiar list, but yes — bring the claim form, we complete our section |
| 26 | do you take amex | Yes; no cheques |
| 27 | whats included in the essential plan | £18.50/mo — 2 exams, 2 hygiene, X-rays, 10% off other treatment |
| 28 | can i pay for a crown in instalments | Interest-free over 10 months on treatment over £750, subject to credit check |
| 29 | do i have to pay a deposit for a crown | 50% on courses over £400; lab portion non-refundable once ordered |

## Appointments and policies — `05-appointments-and-policies.md`

| # | Question | Answer must contain |
|---|---|---|
| 30 | how much notice do i need to give to cancel | At least 24 hours |
| 31 | what happens if i miss my appointment | Fee from second occurrence; £30/£45/£75 by appointment type |
| 32 | im going to be 15 mins late can i still be seen | Over 10 minutes late may not be seen; treated as late cancellation |
| 33 | can i book a filling online | No — online is exams and hygiene only; treatment by phone |
| 34 | do i have to stay with my 10 year old during her appointment | Yes — under 16s accompanied, parent stays in the practice |
| 35 | im really scared of the dentist can i just come and look round first | Yes — familiarisation visit, no charge, longer appointments available |
| 36 | do you send reminders | Text 3 days before and day before; reminders are a courtesy |

## Practice information — `06-practice-information.md`

| # | Question | Answer must contain |
|---|---|---|
| 37 | what time do you close on friday | 4:00pm |
| 38 | are you open saturdays | 9am–1pm, first and third Saturday of the month |
| 39 | is there parking | Six patient spaces at the rear; on-street and Market Street overflow |
| 40 | is the practice wheelchair accessible | Yes — step-free rear entrance, all on ground floor |
| 41 | are you open on bank holidays | Closed; also closed Christmas Eve to New Year's Day |
| 42 | which buses stop near you | 14 and 22 outside; 7 on Market Street |

## Aftercare — `07-treatment-aftercare.md`

| # | Question | Answer must contain |
|---|---|---|
| 43 | can i eat after a filling | Yes once numbness has gone — white fillings set hard before you leave |
| 44 | how long before i can rinse after having a tooth out | Not at all for 24 hours; then warm salty water |
| 45 | my temporary crown came off what do i do | Keep it, telephone — usually recemented same day |
| 46 | my filling feels too high when i bite | Telephone for adjustment; do not wait |
| 47 | can i smoke after having a tooth out | No — substantially increases dry socket risk |

## New patients and emergencies — `08-new-patients-and-emergencies.md`

| # | Question | Answer must contain |
|---|---|---|
| 48 | what do i need to bring to my first appointment | Medicines list, medical conditions/allergies, previous dentist, NHS exemption evidence, insurance details |
| 49 | my tooth got knocked out playing football what do i do | Hold by crown, rinse in milk, reinsert or store in milk, phone immediately |
| 50 | my crown fell out but it doesnt hurt is that an emergency | No — can wait for a routine appointment |

---

## Notes on specific questions

**#14** spans two documents — the £85 private fee is in the fee guide, the £27.90 NHS figure is in the emergencies document. A good answer gives both. Use this one to check whether your top-k is wide enough to pull from two sources.

**#25** is the nuance test. The naive failure is a flat "no, we don't accept Vitality." The corpus says insurers not on the list are still fine. If the bot gets this wrong it is pattern-matching on the list rather than reading the paragraph underneath it.

**#32** requires the bot to convert "15 minutes" into "more than 10 minutes" and apply the rule. Arithmetic against a policy, not lookup.

**#20** is the most commonly misunderstood thing in NHS dentistry and a genuinely useful thing for the bot to get right. Worth featuring in the Loom video.
