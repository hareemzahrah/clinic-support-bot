/**
 * Load environment variables for standalone scripts.
 *
 * Next.js loads .env.local automatically, but scripts run through tsx do not — and
 * `import 'dotenv/config'` reads .env, not .env.local. Importing this module first
 * makes a script see the same variables the app does.
 *
 * .env.local wins over .env, matching Next.js's precedence.
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
