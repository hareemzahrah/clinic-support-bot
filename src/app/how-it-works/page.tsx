import Link from 'next/link';

/**
 * The engineering write-up, kept off the front page.
 *
 * A clinic owner wants to see the assistant working on a practice site; a technical client
 * wants the numbers and the reasoning. Separating them means neither audience has to scroll
 * past the other's page.
 */

export const metadata = {
  title: 'How the assistant works — Ashfield Dental demo',
  description:
    'How a retrieval-augmented support assistant was built, measured and tested against a 65-question suite.',
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-5 py-4">
      <p className="font-display text-3xl font-semibold text-navy-700">{value}</p>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="text-sm text-ink-soft underline underline-offset-4 transition hover:text-ink"
        >
          ← Back to the practice site
        </Link>

        <p className="mt-10 text-sm font-medium tracking-wide text-navy-600 uppercase">
          Portfolio demo
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
          A support assistant that admits what it doesn&rsquo;t know
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          It answers patient questions from the practice&rsquo;s own documents. When the answer
          isn&rsquo;t in those documents it says so and takes the patient&rsquo;s details, rather
          than inventing something plausible.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value="50/50" label="Answerable questions correct" />
          <Stat value="15/15" label="Unanswerable ones refused" />
          <Stat value="0.9¢" label="Cost per message" />
          <Stat value="65" label="Indexed passages" />
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">The problem worth solving</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Any competent developer can wire a chatbot to a set of documents. The difficulty is
            what happens when someone asks a question the documents do not answer &mdash; because
            search will still return something, and it will still look relevant.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            The corpus here has a warm paragraph about looking after nervous patients. It says
            nothing about sedation. Ask &ldquo;do you offer sedation?&rdquo; and that paragraph
            comes back with a similarity of <strong className="text-ink">0.476</strong> &mdash;
            higher than most genuine questions score against their own source document. A real
            question about cancellation notice scores 0.319.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            So no similarity cutoff separates them. I measured this rather than assumed it, and
            the measurement changed the design: the threshold does nothing but discard nonsense,
            and the grounding prompt carries every refusal.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">How it is tested</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Two suites, written before the code. Fifty questions with real answers in the
            documents, phrased the way patients actually type them. Fifteen with no answer at
            all &mdash; thirteen of which retrieve confident, plausible, wrong context.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            The second suite is the release gate: <strong className="text-ink">all fifteen must
            refuse</strong>, every run. It has held across four consecutive runs, including the
            two cases worth trying yourself &mdash; the sedation question, and describing
            toothache to see whether it will diagnose you.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">What a practice gets</h2>
          <dl className="mt-5 space-y-5 leading-relaxed">
            <div>
              <dt className="font-medium">Fewer repeated phone calls</dt>
              <dd className="mt-1 text-ink-soft">
                Fees, opening hours, cancellation policy and aftercare, answered instantly and
                correctly, at any hour.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Enquiries captured instead of lost</dt>
              <dd className="mt-1 text-ink-soft">
                A question the documents cannot answer becomes a name and a number, with the
                original question attached so whoever rings back has context.
              </dd>
            </div>
            <div>
              <dt className="font-medium">A list of what their website is missing</dt>
              <dd className="mt-1 text-ink-soft">
                Every unanswered question is logged. That list is the practice&rsquo;s content
                to-do, written by their own patients.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-14 rounded-2xl border border-line bg-paper-tint p-6">
          <h2 className="font-display text-xl font-semibold">Built with</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Next.js and TypeScript, Postgres with pgvector for retrieval, Voyage AI embeddings,
            and Claude for generation. Streaming replies, prompt caching, per-IP and per-session
            rate limits, and a hard spend cap. The widget embeds on any site with a single script
            tag and is isolated in a shadow root so the host page&rsquo;s CSS cannot reach it.
          </p>
        </section>

        <footer className="mt-14 border-t border-line pt-6 text-sm text-ink-faint">
          <p>
            Ashfield Dental Practice is fictional. Its documents were written for this project
            after researching how real UK practices publish theirs; no practice&rsquo;s content
            has been copied.
          </p>
          <p className="mt-4">
            <Link href="/" className="underline underline-offset-4 hover:text-ink">
              ← Back to the practice site
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
