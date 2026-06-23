# NOW Insight

A personal, public, **educational** website that helps general retail investors make sense of
**ServiceNow (ticker: NOW)** stock — both why it moves and what today's price implies about the
market's expectations.

> **Not investment advice. Personal project. Not affiliated with or endorsed by ServiceNow.**
> Ticker is **NOW** (ServiceNow), never SNOW (Snowflake).

See [`CLAUDE.md`](./CLAUDE.md) for the full project spec and the non-negotiable hard rules.

## Hard rules (do not violate)

- **Public sources only.** Every number derives from SEC EDGAR filings or public market data. No
  material nonpublic information, ever.
- **Prominent disclaimers on every page** (rendered globally in `src/components/Disclaimers.tsx`).
- **No buy/sell recommendations.** Explain and educate; never tell anyone what to do.
- **No accounts, no login, no collected personal data.** Public static pages only.
- **API keys live server-side only** (env vars / route handlers), never in client code.

## Phase 1 status

- ✅ **Reverse-DCF / implied-expectations page** (`/reverse-dcf`) — the centerpiece, built first.
- ⬜ Daily-move decomposition page (next).
- ⬜ Valuation-context page (next).

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then paste your Finnhub key
npm run dev                         # http://localhost:3000
```

## Price data provider — Finnhub

The live delayed quote is fetched **server-side** in `src/app/api/quote/route.ts` using
`FINNHUB_API_KEY`. Get a free key at https://finnhub.io and put it in `.env.local`.

> ⚠️ **TODO before public launch:** verify Finnhub's terms of service permit **public display /
> redistribution** of delayed quotes. Free tiers often restrict this. (EDGAR data has no such
> restriction.) If Finnhub's terms don't allow it, swap the provider in `route.ts`.

If no key is set, the app falls back to a clearly-labeled placeholder price so the page still works
in development.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Recharts.

## The stock-split rule (easy to get wrong)

ServiceNow did a **5-for-1 split effective 2025-12-17**. Historical EDGAR share counts are
**pre-split** (~200M); current shares (~1.03B) and price (~$104) are **post-split**. The model works
in **market-cap / enterprise-value** terms (split-invariant) and only converts to per-share at the
very end using the current post-split share count. Never mix the two bases.
