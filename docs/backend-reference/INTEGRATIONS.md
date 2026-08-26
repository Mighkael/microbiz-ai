# QuickBooks & Plaid Integration Plan

The goal of both integrations is the same: fill the `monthly_financials` table
automatically so every chart, projection, stress test, and AI answer runs on
**real numbers instead of the owner's estimates**. This is the moment MicroBiz AI
goes from "calculator" to "product people pay for monthly."

Recommended order: **QuickBooks first** (it gives you a categorized P&L directly),
Plaid second (bank data covers owners who don't use accounting software).

---

## Part 1 — QuickBooks Online (QBO)

### What you get
The Profit & Loss report API returns revenue, COGS, payroll, and operating
expenses already categorized by month — an almost perfect match for our schema.

### Setup steps
1. Create a developer account at developer.intuit.com and register an app
   (choose the **Accounting** scope, `com.intuit.quickbooks.accounting`).
2. Start in the **sandbox** environment; Intuit gives you a fake company with data.
3. Implement OAuth 2.0:
   - `GET /api/integrations/quickbooks/connect` → redirect the user to Intuit's
     authorization URL with your client ID, scope, and a `state` token.
   - `GET /api/integrations/quickbooks/callback` → exchange the code for an
     `access_token` (valid ~1 hour) and `refresh_token` (valid ~100 days).
   - Store both **encrypted** in the `integrations` table along with the
     `realmId` (QBO's company ID) in `external_id`.
4. Token refresh: a scheduled job (Vercel Cron or Supabase Edge Function,
   e.g. daily) calls the token endpoint with the refresh token and re-encrypts
   the new pair. If refresh fails, set `status = 'error'` and email the user
   to reconnect.

### Sync job (the core)
Run nightly per connected business:

```
GET /v3/company/{realmId}/reports/ProfitAndLoss
    ?start_date=2025-09-01&end_date=2026-08-31
    &summarize_column_by=Month&accounting_method=Accrual
```

Map the response rows → upsert into `monthly_financials`:

| QBO P&L section            | Our column |
|----------------------------|-----------|
| Total Income               | revenue   |
| Total Cost of Goods Sold   | cogs      |
| Payroll expense accounts   | payroll   |
| Remaining Total Expenses   | opex      |

Set `source = 'quickbooks'`, then recompute `metric_snapshots` and refresh
`funding_matches`. Never overwrite a month the user edited manually unless
they opt in ("Trust QuickBooks for this month?").

### Gotchas
- Rate limit is ~500 requests/min per realm — trivial for nightly syncs.
- You must pass Intuit's security questionnaire before production keys.
- Handle `401` (expired token) and `403` (disconnected) by marking the
  integration errored, not by retry loops.

---

## Part 2 — Plaid (bank accounts)

### What you get
Raw bank transactions with Plaid's category enrichment. Less structured than
QBO, but works for every owner with a bank account — and it's the only way to
get a **daily cash balance**, which makes your runway number real.

### Setup steps
1. Create an account at dashboard.plaid.com; start in **Sandbox** (free, fake
   banks), then **Production**. Products needed: `transactions` (and optionally
   `auth` later if you add payments).
2. Frontend: embed **Plaid Link** (their drop-in widget). Flow:
   - Your server creates a `link_token` (`POST /link/token/create`).
   - User picks their bank and logs in inside Plaid's widget.
   - Widget returns a `public_token` → your server exchanges it
     (`POST /item/public_token/exchange`) for an `access_token` + `item_id`.
   - Store encrypted in `integrations` (`provider = 'plaid'`).
3. Sync with `POST /transactions/sync` (cursor-based — store the cursor on the
   integration row). Also call `POST /accounts/balance/get` for cash balances.
4. Register a **webhook** endpoint (`/api/integrations/plaid/webhook`) so Plaid
   pushes `SYNC_UPDATES_AVAILABLE` instead of you polling.

### Mapping transactions → monthly_financials
- Inflows categorized as income/deposits (excluding transfers between own
  accounts) → `revenue` (label it "cash-basis revenue" in the UI).
- Outflows: use Plaid's `personal_finance_category`:
  - `RENT_AND_UTILITIES`, `GENERAL_SERVICES`, insurance, software → `opex`
  - payroll providers (Gusto, ADP, Paychex merchant names) → `payroll`
  - `LOAN_PAYMENTS` → `debt_payments`
  - inventory/suppliers → `cogs` (hardest to classify — let users recategorize,
    and consider a small Claude call to classify ambiguous merchants)
- Month-end `balances.available` across accounts → `cash_balance`.
- Set `source = 'plaid'`.

### Gotchas
- Plaid pricing is per connected Item (~$0.30–$1.50/mo depending on products
  and volume) — build it into your paid tier, don't offer it free.
- Transfers between the owner's own accounts will double-count as revenue if
  you don't filter `TRANSFER_IN`/`TRANSFER_OUT` categories.
- Items go stale when banks force re-login; handle the
  `ITEM_LOGIN_REQUIRED` webhook by prompting reconnection in-app.

---

## Part 3 — Security & compliance (applies to both)

1. **Encrypt tokens at rest.** Supabase Vault/pgsodium or AWS KMS. The
   `integrations` table stores ciphertext only; decryption happens server-side
   at sync time. Never send tokens to the browser.
2. **Least privilege.** Request only the scopes/products you use.
3. **Deletion.** When a user disconnects or deletes their account, revoke the
   token with the provider (Intuit revoke endpoint / Plaid `/item/remove`) and
   hard-delete the row. Put this in your privacy policy.
4. **Audit trail.** Log every sync (time, rows written, errors) — you'll need
   it for support and for provider security reviews.
5. **Disclosures.** Both providers require your privacy policy to name them
   and describe data use before production approval.

---

## Part 4 — Build order & effort estimate

| Phase | Work | Rough effort |
|-------|------|--------------|
| 1 | QBO OAuth + nightly P&L sync into `monthly_financials` | 1–2 weeks |
| 2 | Snapshot recompute + "connected data" badges in UI | 2–3 days |
| 3 | Plaid Link + transactions sync + balance capture | 1–2 weeks |
| 4 | Merchant recategorization UI + Claude-assisted classification | 1 week |
| 5 | Webhooks, token refresh jobs, error/reconnect flows | 1 week |

Ship Phase 1–2 alone first — "connect QuickBooks, get a live health score"
is already a compelling paid feature.
