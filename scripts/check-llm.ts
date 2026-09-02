/**
 * Verify the Anthropic key works and report real token usage.
 *
 *   npm run check:llm
 *
 * Costs a fraction of a cent. Worth running before building on the key, and useful later for
 * telling "the model is wrong" apart from "the key is wrong".
 */

import './load-env';
import Anthropic from '@anthropic-ai/sdk';

// Opus 5 pricing, US dollars per million tokens.
const INPUT_PER_MTOK = 5;
const OUTPUT_PER_MTOK = 25;

export const MODEL = 'claude-opus-5';

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const client = new Anthropic();

  console.log(`Calling ${MODEL}...\n`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly the word: ok',
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const { input_tokens: input, output_tokens: output } = response.usage;
  const cost = (input / 1e6) * INPUT_PER_MTOK + (output / 1e6) * OUTPUT_PER_MTOK;

  console.log(`  reply        "${text}"`);
  console.log(`  stop_reason  ${response.stop_reason}`);
  console.log(`  tokens       ${input} in, ${output} out`);
  console.log(`  cost         $${cost.toFixed(6)}`);
  console.log('');
  console.log('Key works.');
}

main().catch((cause) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.error(`\nFailed: ${message}\n`);
  if (message.includes('401') || message.toLowerCase().includes('authentication')) {
    console.error('The key was rejected. Check it was copied whole, with no leading space.');
  } else if (message.includes('credit') || message.includes('billing')) {
    console.error('Billing problem — check the credit balance in the Anthropic console.');
  }
  process.exit(1);
});
