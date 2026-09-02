# MicroBiz AI Support

AI-enabled business intelligence, financial analysis, and decision support for small and microbusinesses — built for owners who have historically lacked access to the accountants, analysts, and consultants that larger companies take for granted.

## The problem

Most businesses with fewer than ten employees have no in-house financial analyst. They typically have no objective read on how healthy the business really is, how much of a downturn it could survive, or which federal and state funding programs they actually qualify for — a gap that hits hardest in lower-income and historically disinvested communities, where professional business advisory services are scarcest and a single struggling small business has an outsized effect on neighborhood employment.

## Who it's for

Owner-operators of small and microbusinesses — retail, restaurants, trades, personal services, and similar main-street operations — who want a fast, honest read on their numbers without hiring a consultant or connecting a bank account.

## What it does

- **Business assessment** — nine quick questions (industry, location, revenue, expenses, cash, employees, age, top challenges) unlock the full dashboard, no account required.
- **Financial analysis** — instant operating margin, monthly cash flow, break-even revenue, and a composite 0–98 health score, benchmarked against eleven industry sectors.
- **Risk & stress testing** — drag two sliders to simulate a revenue drop and expense increase and see the effect on cash flow and runway in real time, plus a five-point lender credit-readiness checklist.
- **AI business advisor** — ask questions in plain language and get answers grounded in the business's own numbers (powered by Claude), not generic advice.
- **Location intelligence** — geocodes the business address and checks it against the federal Opportunity Zone dataset (U.S. Treasury/HUD) to flag operation in a federally designated economically distressed community.
- **Funding matcher** — recommends specific SBA loan programs, federal/state grants, and CDFI financing based on the business's stated need and credit readiness.
- **News & Markets** — live, source-verified small-business news, market indicators, and opportunity briefings via Claude's web-search tool.
- **Accounts** — signed-in users get their profile and monthly financials persisted to Postgres (Supabase) with Row-Level Security, instead of only the local device.

## Architecture

```
Browser (Next.js / React / TypeScript)
  ├─ Assessment intake + client-side financial engine (instant feedback)
  └─ Dashboard: Financials · Risk · AI Advisor · Funding · News
          │
          ├─ /api/advisor   → Anthropic Claude (grounded chat; key stays server-side)
          ├─ /api/briefing  → Claude + live web search (source-verified news/markets)
          └─ /api/location  → OpenStreetMap Nominatim → HUD/Treasury Opportunity Zone data
          │
          └─ Supabase / PostgreSQL (Row-Level Security) — signed-in accounts only
```

The financial-analysis formulas (margin, break-even, runway, health score) are implemented twice on purpose: once client-side for instant feedback as the user types, and once server-side (`lib/metrics.ts`) as the authoritative version the AI advisor is briefed from — so the two can never drift apart.

## Technology stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind v4 + a hand-rolled design-token system (`lib/theme.ts`)
- **AI:** Anthropic Claude (`@anthropic-ai/sdk`) — advisor chat and web-search-grounded briefings
- **Data/auth:** Supabase (Postgres + Auth, `@supabase/ssr`)
- **Maps/charts:** Leaflet, Recharts
- **Location data:** OpenStreetMap Nominatim (geocoding), HUD/Treasury Opportunity Zone FeatureServer (federal designation)

See `docs/backend-reference/` for the full production backend plan: the Postgres schema with Row-Level Security, a pre-launch security checklist, cost modeling, and a QuickBooks/Plaid integration roadmap.

## Current development status

Functional prototype. The assessment, financial engine, risk/stress-test tools, AI advisor, funding matcher, and location intelligence are all live and working end to end, including for signed-in accounts with persisted data. Not yet done: public deployment, third-party user testing, and letters of interest from real business owners.

## Future development

- QuickBooks and Plaid integration so financials update automatically instead of being entered manually
- Multi-month financial history and trend charts (schema already supports it — see `docs/backend-reference/db/schema.sql`)
- Daily AI usage caps and edge rate limiting ahead of public launch
- Expanded funding-program and CDFI coverage by state

## Getting started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (see docs/backend-reference/.env.example for Supabase)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without an `ANTHROPIC_API_KEY`, everything works except the AI Advisor, News & Markets, and location-based "personalize with live research" features.

## License

No license file has been added yet. All rights reserved by default until one is chosen.
