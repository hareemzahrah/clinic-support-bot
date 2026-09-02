/**
 * Create (or reset) the dashboard demo account.
 *
 *   npm run create:demo-user
 *
 * Uses the service-role key's admin API, so it does not need the Supabase dashboard and does
 * not send a confirmation email. Idempotent: run it again to reset the password if the demo
 * account drifts.
 *
 * The credentials are published on the sign-in page on purpose — a login a prospective client
 * cannot get past shows them nothing, and the account only ever sees fictional data.
 */

import './load-env';
import { getSupabase } from '../src/lib/supabase';

const EMAIL = 'demo@ashfielddental.example';
const PASSWORD = 'ashfield-demo-2026';

async function main() {
  const supabase = getSupabase();

  const { data: existing } = await supabase.auth.admin.listUsers();
  const already = existing?.users.find((u) => u.email === EMAIL);

  if (already) {
    const { error } = await supabase.auth.admin.updateUserById(already.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not reset the demo account: ${error.message}`);
    console.log(`Demo account already existed — password reset.\n  ${EMAIL} / ${PASSWORD}`);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    // Confirmed on creation so signing in works without an inbox for a fictional domain.
    email_confirm: true,
  });

  if (error) throw new Error(`Could not create the demo account: ${error.message}`);
  console.log(`Demo account created.\n  ${EMAIL} / ${PASSWORD}`);
}

main().catch((cause) => {
  console.error(`\n${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
