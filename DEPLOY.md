# Deploying

Roughly half an hour. Order matters — the keep-alive needs a live URL, and Vercel needs a repo.

## 1. Push to GitHub

The repo has no remote yet. Create an **empty** repository on GitHub (no README, no .gitignore —
this project already has both), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/clinic-support-bot.git
git branch -M main
git push -u origin main
```

`.env.local` is gitignored and has never been committed. Confirm before pushing:

```bash
git ls-files | grep -i "env"
```

That should print `.env.example` and nothing else.

## 2. Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repository
2. Framework preset detects Next.js; leave the build settings alone
3. **Add the environment variables before the first deploy**, or it will fail at build:

| Variable | Where it came from |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → **Secret** key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → **Publishable** key |
| `VOYAGE_API_KEY` | dashboard.voyageai.com |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `IP_HASH_SALT` | Any long random string. Generate one, don't reuse a key |

Do **not** set `DAILY_IP_LIMIT` in production. It exists to raise the cap during development;
unset, it defaults to 20 per IP per day, which is the point.

Copy the values from `.env.local` — but note `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold
the same value under two names, because one is server-only and one is bundled into the browser.

## 3. Keep the demo from dying

Supabase pauses free projects after **seven consecutive days** with no database activity. A
paused project accepts no connections, so a link in a proposal is dead by the time a client
clicks it the following week. That reads as neglect rather than as a free tier expiring.

The workflow in `.github/workflows/keep-alive.yml` pings `/api/health` daily, which runs a real
database query. Give it the URL:

**GitHub → Settings → Secrets and variables → Actions → Variables → New repository variable**

```
Name:  KEEP_ALIVE_URL
Value: https://your-deployment.vercel.app/api/health
```

Then run it once by hand — **Actions → Keep alive → Run workflow** — rather than waiting a day
to discover it was misconfigured.

## 4. Point the embed script at production

`public/embed-test.html` loads `/widget.js` from the same origin, so it works on the deployment
untouched. For a real clinic, the tag is:

```html
<script src="https://your-deployment.vercel.app/widget.js" defer></script>
```

## 5. Before sending the link to anyone

- [ ] `/` loads, the widget opens, and a question streams an answer
- [ ] Ask **"do you offer sedation for nervous patients?"** — it must decline and offer the form
- [ ] `/admin` redirects to `/login`, and the demo button signs in
- [ ] `/api/health` returns `{"ok":true}`
- [ ] The keep-alive workflow has one successful run
- [ ] **Anthropic credit balance is topped up.** A demo failing on insufficient credit in front
      of a client is the worst possible failure — and the cheapest to prevent
- [ ] **A payment method is on the Voyage account.** Without one the free tier is capped at 3
      requests per minute, and a client asking four questions in a row will hit errors. The 200M
      free tokens still apply; the card only lifts the rate limit

## Re-seeding a deployed instance

The scripts read `.env.local` and talk to Supabase directly, so they work against production
from your machine without redeploying:

```bash
npm run seed              # re-index the corpus after editing content/
npm run seed:demo:reset   # rebuild the dashboard's demo history
npm run create:demo-user  # reset the demo login password
```
