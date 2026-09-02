import Image from 'next/image';
import Link from 'next/link';
import { ChatWidget } from '@/components/chat/ChatWidget';

/**
 * Ashfield Dental Practice — built from the Stitch export.
 *
 * Structure and styling follow the design; the content follows the indexed corpus, and so do
 * its omissions. No clinician names, no sedation, no implants placed in house. Those are gaps
 * the assistant is deliberately tested on refusing, and a page contradicting them would make
 * the demo incoherent — so a few of the Stitch placeholders (50,000 patients, 14 specialists,
 * a Lahore address) are replaced with facts the documents actually support.
 *
 * Images are served from /public rather than the Google CDN links Stitch emitted. Those are
 * temporary URLs; a portfolio demo has to still work in six months.
 */

const TRUST = [
  { icon: 'clock', label: 'Evening and Saturday appointments' },
  { icon: 'shield', label: 'Strict sterilisation and cross-infection protocols' },
  { icon: 'tag', label: 'Full fee guide published — no need to ring and ask' },
  { icon: 'bolt', label: 'Emergency slots kept free every weekday' },
];

const SERVICES = [
  { name: 'Dental Check-up', blurb: 'Comprehensive oral examination', image: '/img/checkup.jpg', price: 'From £54' },
  { name: 'Dental Emergency', blurb: 'Seen the same day', image: '/img/emergency.jpg', price: '£85' },
  { name: 'Teeth Whitening', blurb: 'Custom trays, professional gel', image: '/img/whitening.jpg', price: '£340' },
  { name: 'Clear Aligners', blurb: 'Six to eighteen months', image: '/img/aligners.jpg', price: 'From £2,400' },
  { name: 'Crowns & Bridges', blurb: 'Porcelain, bonded or gold', image: '/img/crown.jpg', price: 'From £720' },
  { name: 'Root Canal Treatment', blurb: 'Save your natural tooth', image: '/img/rootcanal.jpg', price: 'From £420' },
];

const HOURS = [
  ['Monday – Thursday', '8:30am – 5:30pm'],
  ['Wednesday late', 'until 7:30pm'],
  ['Friday', '8:30am – 4:00pm'],
  ['Saturday', '9:00am – 1:00pm, 1st & 3rd'],
  ['Sunday', 'Closed'],
];

function Icon({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    shield: 'M12 3 4.5 6v5.5c0 4.3 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5.2 7.5-9.5V6L12 3Z',
    tag: 'M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z M7.5 7.5h.01',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Header() {
  return (
    <header className="fixed top-0 z-40 w-full">
      <div className="mx-auto flex max-w-[1440px] items-center gap-6 rounded-b-[2rem] bg-primary-container px-6 py-3 shadow-lg shadow-secondary-container/20 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary">
            A
          </span>
          <span className="font-display text-lg font-bold text-on-surface">Ashfield Dental</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {[
            ['Treatments', '#treatments'],
            ['Fees', '#fees'],
            ['NHS & private', '#nhs'],
            ['Visiting us', '#visit'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="font-label rounded-full px-3 py-2 text-xs text-on-primary-container transition hover:bg-primary/10 hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a
            href="tel:01632960148"
            className="font-label hidden rounded-full border border-primary px-4 py-2 text-xs text-primary transition hover:bg-primary/10 sm:block"
          >
            01632 960148
          </a>
          <a
            href="#visit"
            className="font-label glow-cta rounded-full bg-cta px-4 py-2 text-xs text-white transition hover:bg-cta-hover"
          >
            Book Appointment
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[600px] items-center pt-24">
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-page/95 via-page/80 to-page/40" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="font-label text-xs text-primary uppercase">Milbury · Established practice</p>
          <h1 className="font-display mt-4 text-4xl leading-[1.08] font-bold text-on-surface sm:text-5xl lg:text-[3.5rem]">
            Dentistry without
            <br />
            the guesswork.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-on-surface-variant">
            Straight answers about what treatment costs, what it involves and when we can see
            you. Our full fee guide is on this page — no need to ring and ask.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#visit"
              className="font-label glow-cta rounded-lg bg-cta px-8 py-3 text-xs text-white transition hover:bg-cta-hover"
            >
              Book Appointment
            </a>
            <a
              href="#fees"
              className="font-label rounded-lg border border-outline-variant bg-surface-high px-8 py-3 text-xs text-on-surface transition hover:bg-surface-variant"
            >
              See Our Fees
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <div className="relative z-20 mx-auto -mt-12 mb-8 max-w-[1440px] px-6 sm:px-8">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-outline-variant/30 bg-outline-variant/30 shadow-lg shadow-black/50 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((item) => (
          <div
            key={item.label}
            className="group relative flex items-center gap-3 bg-surface-high p-4 transition-colors hover:bg-surface-variant"
          >
            <span className="text-primary">
              <Icon name={item.icon} className="h-7 w-7" />
            </span>
            <p className="font-label text-xs leading-relaxed text-on-surface">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Treatments() {
  return (
    <section id="treatments" className="mx-auto max-w-[1440px] px-6 py-20 sm:px-8">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-bold text-on-surface sm:text-4xl">
          Dental Services in Milbury
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-on-surface-variant">
          General, preventive, restorative and cosmetic dentistry for adults and children.
        </p>
      </div>

      <div className="grid auto-rows-[280px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <article
            key={service.name}
            className="group relative overflow-hidden rounded-xl border border-outline-variant/30 bg-black shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-colors hover:border-cta/50"
          >
            <Image
              src={service.image}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-primary-container to-transparent opacity-80" />

            <div className="absolute bottom-0 left-0 z-20 w-full border-t border-primary/20 bg-primary-container/90 p-4 backdrop-blur-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-on-surface">
                  {service.name}
                </h3>
                <span className="font-label shrink-0 text-xs text-primary">{service.price}</span>
              </div>
              <p className="font-label mt-1 text-xs text-on-primary-container opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {service.blurb}
              </p>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-on-surface-variant/70">
        We do not place implants, fit fixed metal braces, offer in-chair power whitening or work
        under general anaesthetic. Surgical extractions go to an oral surgeon.
      </p>
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
    <section id="fees" className="border-y border-outline-variant/30 bg-surface-low">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Our fees, in public</h2>
          <p className="mt-4 leading-relaxed text-on-surface-variant">
            Most practices make you ring to find out what something costs. We would rather you
            knew before you walked in. You will always get a written treatment plan with exact
            costs before any work begins.
          </p>
          <div className="mt-6 rounded-xl border border-outline-variant/30 bg-surface-mid p-5">
            <p className="font-display text-lg font-semibold">Spreading the cost</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Interest-free finance over ten months on treatment above £750, subject to a credit
              check. Our monthly care plan starts at £18.50 and includes examinations, hygiene
              visits and a discount on everything else.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-mid">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([item, price]) => (
                <tr key={item} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-5 py-3.5 text-on-surface-variant">{item}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-primary">{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-label border-t border-outline-variant/30 bg-surface-low px-5 py-3 text-[11px] text-on-surface-variant/60">
            Private fees, effective 1 January 2026. NHS charges are set nationally.
          </p>
        </div>
      </div>
    </section>
  );
}

function NhsPrivate() {
  const cards = [
    {
      title: 'Our NHS list is full',
      body: 'We are not taking new adult NHS patients at present. We keep an expression-of-interest list and contact people when capacity comes up. Children under 18 of registered adults can be added.',
      highlight: true,
    },
    {
      title: 'NHS charges',
      body: 'Band 1 £27.90, Band 2 £76.60, Band 3 £332.10. One charge per course of treatment, not per item — three fillings is a single Band 2 charge.',
      highlight: false,
    },
    {
      title: 'Free treatment',
      body: 'Under 18s, under 19s in full-time education, pregnant patients and those who have had a baby in the last year, and people on qualifying benefits.',
      highlight: false,
    },
  ];

  return (
    <section id="nhs" className="mx-auto max-w-[1440px] px-6 py-20 sm:px-8">
      <h2 className="font-display text-3xl font-bold sm:text-4xl">NHS &amp; private care</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-xl border p-6 ${
              card.highlight
                ? 'border-cta/40 bg-primary-container/40'
                : 'border-outline-variant/30 bg-surface-low'
            }`}
          >
            <p className="font-display text-lg font-semibold text-on-surface">{card.title}</p>
            <p className="mt-2.5 text-sm leading-relaxed text-on-surface-variant">{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visit" className="border-t border-outline-variant/30 bg-surface-low">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-20 sm:px-8 lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-outline-variant/30 shadow-lg shadow-black/50">
          <Image
            src="/img/reception.jpg"
            alt="Ashfield Dental reception"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-page via-transparent to-transparent opacity-80" />
        </div>

        <div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Visiting us</h2>
          <address className="mt-6 text-lg leading-relaxed text-on-surface-variant not-italic">
            14 Ashfield Road
            <br />
            Milbury, MB3 7QT
          </address>
          <a
            href="tel:01632960148"
            className="font-display mt-4 inline-block text-2xl font-bold text-primary underline underline-offset-8 transition hover:text-secondary"
          >
            01632 960148
          </a>

          <dl className="mt-8 space-y-2 text-sm">
            {HOURS.map(([day, time]) => (
              <div
                key={day}
                className="flex justify-between gap-4 border-b border-outline-variant/20 pb-2 last:border-0"
              >
                <dt className="text-on-surface-variant">{day}</dt>
                <dd className={time === 'Closed' ? 'text-on-surface-variant/50' : 'font-medium'}>
                  {time}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 rounded-lg border border-outline-variant/30 bg-surface-mid px-4 py-3 text-sm text-on-surface-variant">
            Six patient parking spaces at the rear. Step-free access from the car park, and all
            surgeries are on the ground floor.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-outline-variant/30 bg-surface-lowest pt-14 pb-8">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold text-primary">
              Ashfield Dental Practice
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-on-surface-variant">
              Specialist dental care in Milbury. NHS and private treatment, with our full fee
              guide published so you know the cost before you arrive.
            </p>
          </div>

          <div>
            <p className="font-label mb-3 text-xs text-primary uppercase">Treatments</p>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              {['Examinations & hygiene', 'White fillings', 'Crowns & bridges', 'Clear aligners', 'Teeth whitening'].map(
                (item) => (
                  <li key={item}>{item}</li>
                ),
              )}
            </ul>
          </div>

          <div>
            <p className="font-label mb-3 text-xs text-primary uppercase">Get in touch</p>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>14 Ashfield Road, Milbury, MB3 7QT</li>
              <li>
                <a href="tel:01632960148" className="transition hover:text-primary">
                  01632 960148
                </a>
              </li>
              <li>reception@ashfielddental.example</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-outline-variant/30 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-on-surface-variant/60">
            Ashfield Dental Practice is fictional — a portfolio demonstration.
          </p>
          <Link
            href="/how-it-works"
            className="font-label text-xs text-primary underline underline-offset-4 transition hover:text-secondary"
          >
            How the assistant works
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Treatments />
        <Fees />
        <NhsPrivate />
        <Visit />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
