import Link from 'next/link';
import { ChatWidget } from '@/components/chat/ChatWidget';

/**
 * The Ashfield Dental Practice website.
 *
 * This is the demo's whole point: a client evaluating the work should see the assistant sitting
 * on a real practice site, not on a page explaining the project. The engineering write-up lives
 * at /how-it-works for anyone who wants it.
 *
 * Every fact here matches the indexed corpus, and the omissions match it too. No clinician
 * names, no sedation, no implants placed in house — those are deliberate gaps the assistant is
 * tested on refusing, and a website that contradicted them would make the demo incoherent.
 */

const TREATMENTS = [
  {
    name: 'Examinations & hygiene',
    detail:
      'A full check of teeth, gums, bite and soft tissues, including oral cancer screening. Hygienist appointments to match.',
    price: 'From £54',
  },
  {
    name: 'White fillings',
    detail:
      'Tooth-coloured composite as standard. We no longer place new amalgam, though we will repair or replace existing fillings.',
    price: 'From £135',
  },
  {
    name: 'Crowns & bridges',
    detail:
      'Porcelain, porcelain bonded to metal, or gold. Made by our laboratory over two appointments about a fortnight apart.',
    price: 'From £720',
  },
  {
    name: 'Root canal treatment',
    detail:
      'Front teeth and premolars treated here. Complex molars go to a specialist endodontist we work with.',
    price: 'From £420',
  },
  {
    name: 'Clear aligners',
    detail:
      'For adults and older teenagers with mild to moderate crowding or spacing. Typically six to eighteen months.',
    price: 'From £2,400',
  },
  {
    name: 'Home whitening',
    detail:
      'Custom trays and professional gel, worn overnight or a few hours daily across two to three weeks.',
    price: '£340',
  },
];

const HOURS = [
  ['Monday', '8:30am – 5:30pm'],
  ['Tuesday', '8:30am – 5:30pm'],
  ['Wednesday', '8:30am – 7:30pm'],
  ['Thursday', '8:30am – 5:30pm'],
  ['Friday', '8:30am – 4:00pm'],
  ['Saturday', '9:00am – 1:00pm, 1st & 3rd'],
  ['Sunday', 'Closed'],
];

function DemoBanner() {
  return (
    <div className="bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2 text-center text-[13px]">
        <span className="text-paper/70">
          Portfolio demo — Ashfield Dental is a fictional practice.
        </span>
        <Link
          href="/how-it-works"
          className="font-medium text-navy-200 underline underline-offset-4 transition hover:text-paper"
        >
          See how the assistant was built
        </Link>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700 text-sm font-semibold text-paper">
            A
          </span>
          <span className="font-display text-lg font-semibold">Ashfield Dental</span>
        </div>

        <nav className="ml-auto hidden items-center gap-7 text-sm text-ink-soft md:flex">
          <a href="#treatments" className="transition hover:text-ink">Treatments</a>
          <a href="#fees" className="transition hover:text-ink">Fees</a>
          <a href="#nhs" className="transition hover:text-ink">NHS &amp; private</a>
          <a href="#visit" className="transition hover:text-ink">Visiting us</a>
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <a
            href="tel:01632960148"
            className="hidden text-sm font-medium text-ink transition hover:text-navy-700 sm:block"
          >
            01632 960148
          </a>
          <a
            href="#visit"
            className="rounded-full bg-navy-700 px-4 py-2 text-sm font-medium text-paper transition hover:bg-navy-800"
          >
            Book an appointment
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-line bg-paper-tint">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
        <div>
          <p className="text-sm font-medium tracking-wide text-navy-600 uppercase">
            Milbury · Established practice
          </p>
          <h1 className="font-display mt-4 text-[2.75rem] leading-[1.05] font-semibold sm:text-6xl">
            Dentistry without
            <br />
            the guesswork.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Straight answers about what treatment costs, what it involves and when we can see
            you. Our full fee guide is on this page — no need to ring and ask.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#visit"
              className="rounded-full bg-navy-700 px-6 py-3 text-sm font-medium text-paper transition hover:bg-navy-800"
            >
              Book an appointment
            </a>
            <a
              href="#fees"
              className="rounded-full border border-ink/15 px-6 py-3 text-sm font-medium text-ink transition hover:border-ink/40"
            >
              See our fees
            </a>
          </div>

          <p className="mt-8 text-sm text-ink-faint">
            Emergency slots kept free every weekday. Ring{' '}
            <a href="tel:01632960148" className="text-ink underline underline-offset-4">
              01632 960148
            </a>{' '}
            early in the day.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-7 shadow-[0_2px_24px_rgba(22,33,28,0.05)]">
          <h2 className="font-display text-xl font-semibold">Opening hours</h2>
          <dl className="mt-5 space-y-2.5 text-sm">
            {HOURS.map(([day, time]) => (
              <div key={day} className="flex justify-between gap-4 border-b border-line/70 pb-2.5 last:border-0">
                <dt className="text-ink-soft">{day}</dt>
                <dd className={time === 'Closed' ? 'text-ink-faint' : 'font-medium'}>{time}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-xl bg-navy-50 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
            Reception is unstaffed between 1pm and 2pm on weekdays. Appointments carry on as
            normal during that hour.
          </p>
        </div>
      </div>
    </section>
  );
}

function Treatments() {
  return (
    <section id="treatments" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">What we do</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          General, preventive, restorative and cosmetic dentistry for adults and children. Where
          something is better handled by a specialist, we refer and look after your routine care
          ourselves.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {TREATMENTS.map((treatment) => (
            <article key={treatment.name} className="bg-paper p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg font-semibold">{treatment.name}</h3>
                <span className="shrink-0 text-sm font-medium text-navy-600">
                  {treatment.price}
                </span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{treatment.detail}</p>
            </article>
          ))}
        </div>

        <p className="mt-6 text-sm text-ink-faint">
          We do not place implants, fit fixed metal braces, offer in-chair power whitening or
          work under general anaesthetic. Surgical extractions go to an oral surgeon.
        </p>
      </div>
    </section>
  );
}

function Fees() {
  const rows = [
    ['New patient examination (45 min)', '£79'],
    ['Routine examination', '£54'],
    ['Hygienist, 30 minutes', '£72'],
    ['White filling, small', '£135'],
    ['Porcelain crown', '£780'],
    ['Straightforward extraction', '£180'],
    ['Emergency appointment', '£85'],
  ];

  return (
    <section id="fees" className="border-b border-line bg-paper-tint">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Our fees, in public</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Most practices make you ring to find out what something costs. We would rather you
            knew before you walked in. You will always get a written treatment plan with exact
            costs before any work begins, and we never proceed with treatment you have not
            agreed to.
          </p>
          <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
            <p className="font-display text-lg font-semibold">Spreading the cost</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Interest-free finance over ten months on treatment above £750, subject to a credit
              check. Our monthly care plan starts at £18.50 and includes examinations, hygiene
              visits and a discount on everything else.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-paper">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([item, price]) => (
                <tr key={item} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 text-ink-soft">{item}</td>
                  <td className="px-5 py-3.5 text-right font-medium">{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line bg-paper-tint px-5 py-3 text-[13px] text-ink-faint">
            Private fees, effective 1 January 2026. NHS charges are set nationally.
          </p>
        </div>
      </div>
    </section>
  );
}

function NhsPrivate() {
  return (
    <section id="nhs" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">NHS &amp; private care</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-navy-200 bg-navy-50 p-6">
            <p className="font-display text-lg font-semibold">Our NHS list is full</p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
              We are not taking new adult NHS patients at present. We keep an expression-of-
              interest list and contact people when capacity comes up. Children under 18 of
              registered adults can be added.
            </p>
          </div>
          <div className="rounded-2xl border border-line p-6">
            <p className="font-display text-lg font-semibold">NHS charges</p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
              Band 1 £27.90, Band 2 £76.60, Band 3 £332.10. One charge per course of treatment,
              not per item — three fillings is a single Band 2 charge.
            </p>
          </div>
          <div className="rounded-2xl border border-line p-6">
            <p className="font-display text-lg font-semibold">Free treatment</p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
              Under 18s, under 19s in full-time education, pregnant patients and those who have
              had a baby in the last year, and people on qualifying benefits.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visit" className="border-b border-line bg-navy-800 text-paper">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Visiting us</h2>
          <address className="mt-6 text-lg not-italic leading-relaxed text-paper/85">
            14 Ashfield Road
            <br />
            Milbury
            <br />
            MB3 7QT
          </address>
          <p className="mt-6">
            <a
              href="tel:01632960148"
              className="font-display text-2xl font-semibold underline underline-offset-8 transition hover:text-navy-200"
            >
              01632 960148
            </a>
          </p>
          <p className="mt-3 text-sm text-paper/60">
            reception@ashfielddental.example — checked once each working day
          </p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-paper/80">
          <div>
            <p className="font-medium text-paper">Parking</p>
            <p className="mt-1">
              Six patient spaces at the rear, via the lane beside the pharmacy. Free two-hour
              on-street parking on Ashfield Road, and a pay-and-display car park on Market
              Street four minutes away.
            </p>
          </div>
          <div>
            <p className="font-medium text-paper">By bus or train</p>
            <p className="mt-1">
              The 14 and 22 stop directly outside; the 7 stops on Market Street. Milbury station
              is fifteen minutes on foot.
            </p>
          </div>
          <div>
            <p className="font-medium text-paper">Access</p>
            <p className="mt-1">
              Single storey with step-free access from the rear car park. All three surgeries,
              the waiting room and the accessible toilet are on the ground floor.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <DemoBanner />
      <Header />
      <main className="flex-1">
        <Hero />
        <Treatments />
        <Fees />
        <NhsPrivate />
        <Visit />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-ink-faint">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p>Ashfield Dental Practice — a fictional practice, built as a portfolio demo.</p>
          <Link href="/how-it-works" className="underline underline-offset-4 hover:text-ink">
            How the assistant works
          </Link>
        </div>
      </footer>

      <ChatWidget />
    </>
  );
}
