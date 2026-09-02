import { ChatWidget } from '@/components/chat/ChatWidget';

/**
 * The demo page a prospective client lands on.
 *
 * Deliberately not a pretend clinic homepage. Someone arriving from an Upwork proposal has
 * thirty seconds and one question — can this person build something that works? So the page
 * leads with what the bot refuses to do, because that is the hard part and the part every
 * serious client is quietly worried about.
 */

const ANSWERABLE = [
  'How much is a check-up?',
  'Are you taking NHS patients?',
  'What happens if I miss my appointment?',
  'Can I smoke after having a tooth out?',
];

const UNANSWERABLE = [
  'Do you offer sedation for nervous patients?',
  'How much for a rugby mouthguard?',
  "I've got throbbing pain at night — do I need a root canal?",
  'Which dental school did my dentist train at?',
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight text-teal-700">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium text-teal-700">Portfolio demo</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          A support chatbot that admits what it doesn&rsquo;t know
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          Built for dental practices. It answers patient questions from the clinic&rsquo;s own
          documents &mdash; fees, opening hours, policies, aftercare &mdash; and when the answer
          isn&rsquo;t in those documents it says so and takes the patient&rsquo;s details instead
          of inventing something.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value="50/50" label="Answerable questions correct" />
          <Stat value="15/15" label="Unanswerable ones refused" />
          <Stat value="0.9&cent;" label="Cost per message" />
          <Stat value="8" label="Source documents indexed" />
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">Try it yourself</h2>
          <p className="mt-2 text-slate-600">
            Open the chat in the corner. Start with something it can answer:
          </p>

          <ul className="mt-4 space-y-2">
            {ANSWERABLE.map((question) => (
              <li
                key={question}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                {question}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-slate-600">
            Then try one of these. <strong className="font-medium text-slate-900">None of
            them have an answer in the clinic&rsquo;s documents</strong> &mdash; but every one
            pulls back text that looks relevant, which is where most chatbots start making things
            up:
          </p>

          <ul className="mt-4 space-y-2">
            {UNANSWERABLE.map((question) => (
              <li
                key={question}
                className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm text-slate-800"
              >
                {question}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
          <dl className="mt-4 space-y-4 text-sm leading-relaxed">
            <div>
              <dt className="font-medium text-slate-900">Retrieval</dt>
              <dd className="mt-1 text-slate-600">
                The clinic&rsquo;s documents are split into 65 passages and indexed as vectors in
                Postgres. Each question is matched against them; the closest few become the only
                material the model is allowed to use.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Refusal</dt>
              <dd className="mt-1 text-slate-600">
                Similarity alone can&rsquo;t separate real questions from gaps &mdash; measured on
                this corpus, the sedation question scores{' '}
                <span className="font-medium text-slate-900">higher</span> against its nearest
                passage than most genuine questions score against their own source. So the model
                is asked a stricter question than &ldquo;is this relevant?&rdquo;: does this text
                state the answer to what was actually asked?
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Handoff</dt>
              <dd className="mt-1 text-slate-600">
                A question the documents can&rsquo;t answer is a lead, not a dead end. The bot
                offers to take a name and number, and the practice gets a dashboard of exactly
                which questions their website is failing to answer.
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Ashfield Dental Practice is fictional and its documents were written for this demo.
            No real practice&rsquo;s content has been used.
          </p>
        </footer>
      </div>

      <ChatWidget />
    </main>
  );
}
