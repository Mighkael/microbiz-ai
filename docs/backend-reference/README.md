# MicroBiz AI — Production Backend Starter Kit

This kit pairs with the `microbiz-ai-platform.jsx` prototype and contains the
production pieces: secure Claude API routes, the database schema, shared
financial-metrics code, and the QuickBooks/Plaid integration plan.

## What's inside

```
db/schema.sql                  Full Postgres/Supabase schema with Row Level Security
lib/metrics.ts                 Pure financial calculations (margin, break-even,
                               runway, health score, stress tests) — unit-testable
app/api/advisor/route.ts       Secure, streaming Claude advisor endpoint with
                               auth, ownership checks, daily caps, and logging
app/api/briefing/route.ts      Live news/markets/opportunities briefings via
                               Claude web search, with a 6-hour shared cache
docs/INTEGRATIONS.md           Step-by-step QuickBooks + Plaid integration plan
.env.example                   Environment variables you'll need
```

## Setup (about 30 minutes)

1. **Create the app**
   ```bash
   npx create-next-app@latest microbiz-ai --typescript --tailwind --app
   cd microbiz-ai
   npm install @anthropic-ai/sdk @supabase/ssr @supabase/supabase-js recharts lucide-react
   ```
2. **Database** — create a free project at supabase.com, open the SQL editor,
   and run `db/schema.sql` (plus the `briefing_cache` table noted at the bottom
   of `app/api/briefing/route.ts`). Add this helper for usage metering:
   ```sql
   create or replace function increment_ai_usage(p_owner uuid)
   returns void language sql security definer as $$
     insert into ai_usage (owner_id, day, requests)
     values (p_owner, current_date, 1)
     on conflict (owner_id, day) do update set requests = ai_usage.requests + 1;
   $$;
   ```
3. **Copy files** — drop `lib/`, `app/api/`, and keep `docs/` in the repo root.
4. **Environment** — copy `.env.example` to `.env.local` and fill in your keys.
   Get an Anthropic API key at console.anthropic.com. **This key lives only on
   the server** — the frontend calls `/api/advisor`, never Anthropic directly.
5. **Frontend** — port the prototype's components into `app/(dashboard)/`,
   replacing its direct `fetch("https://api.anthropic.com…")` calls with
   `fetch("/api/advisor")` and `fetch("/api/briefing")`, and its in-memory
   profile state with Supabase queries.
6. **Deploy** — push to GitHub, import the repo at vercel.com, paste the same
   environment variables into Vercel's project settings, deploy. Add a custom
   domain when ready.

## Security checklist before launch

- [ ] Anthropic key only in server env vars (never `NEXT_PUBLIC_*`)
- [ ] Row Level Security enabled and tested with two different accounts
- [ ] Daily AI usage caps wired to your pricing tiers
- [ ] Input length limits on every route (already in `advisor/route.ts`)
- [ ] Integration tokens encrypted at rest (see INTEGRATIONS.md §3)
- [ ] Terms of service, privacy policy, and "not financial advice" disclaimer
- [ ] Rate limiting at the edge (Vercel WAF or Upstash Ratelimit) on `/api/*`

## Cost picture at launch

- Vercel Hobby + Supabase Free: $0 until you have real traffic
- Anthropic API: roughly $0.01–0.05 per advisor exchange with Sonnet;
  briefing cache keeps web-search calls to a handful per industry per day
- First real costs appear with Plaid connections and Supabase Pro (~$25/mo)
