# CLAUDE.md — NOW Insight

Context for Claude Code. Keep this file updated as the project evolves.

## What this project is

A personal, public, educational website that helps general retail investors make sense of
**ServiceNow (ticker: NOW)** stock — both why it moves day to day, and what the current
price implies about the market's expectations. It is **not** affiliated with ServiceNow and
**not** investment advice. The author works at ServiceNow but this is an independent side project.

Ticker is **NOW**, never SNOW (SNOW is Snowflake). In **code and data** this is a correctness rule:
always use NOW; never pull or display Snowflake/SNOW data. In **user-facing copy**, the explicit
"NOW is not Snowflake" clarification was intentionally removed (homepage fine print + footer) as a
design decision — it read as clutter. The code/data rule still stands; only the explanatory aside is gone.

## Hard rules (do not violate)

- **No material nonpublic information, ever.** Every number on the site must derive from public
  sources (SEC EDGAR filings, public market data). The author has insider status; treat "public
  sources only" as the project's first principle, not a footnote.
- **Disclaimers are required and must be prominent** on every page: "Not investment advice,"
  "Personal project," and "Not affiliated with or endorsed by ServiceNow."
- **No buy/sell recommendations.** The site explains and educates; it never tells anyone what to do.
- **No user accounts, no login, no collected personal data.** Public static pages only.

## Tech stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS for styling
- A React charting library (e.g. Recharts) for visuals
- Local dev: Node.js 24 (LTS) on macOS via Homebrew
- Version control: Git + GitHub. Hosting: Vercel (deploys from GitHub).
- API keys (price data) must live in server-side code / env vars, NEVER in client-side code.

## Redesign (2026-06) — single-page "NOW you know" (CURRENT)

The site was rebuilt from a Claude Design mock into ONE landing page (`src/app/page.tsx`) that
consolidates the three former routes into anchored sections: hero + live quote card → "What's priced
in" → interactive Modeler → price History → stock-movement Basics. Key changes that SUPERSEDE the
Phase 1 notes below:

- **New design system (plain CSS, not Tailwind).** Tokens/components live in `src/app/globals.css`
  using CSS custom properties (`--bg`, `--ink`, `--accent`, …) under `:root[data-theme="brand"]`
  (light, default) with a dormant `terminal` (dark) theme. Accent is **green "growth"** (`#1f9d57`),
  NOT the old editorial teal. Fonts: **Hanken Grotesk** (body), **Schibsted Grotesk** (display),
  **IBM Plex Mono** (numbers), via `next/font/google` in `layout.tsx`. Tailwind is no longer used by
  the page. The old teal/Tailwind `@theme` tokens and `text-ink`/`bg-paper` utilities are gone.
- **There IS a sticky site header + anchor nav now** (reverses the old "no global header" rule) and a
  live ticker pill. Section components live in `src/components/now/*`.
- **One live data route — `/api/overview`** feeds every number via a shared `OverviewProvider`
  (single fetch). It fuses Finnhub quote + basic-financials metric (52-wk range, P/E) with EDGAR
  fundamentals. `lib/edgar.ts` `fetchFundamentals()` computes TTM revenue, reported YoY growth, and
  FCF margin — using a **cumulative-reconstruction TTM** (full year + current YTD − prior-year YTD)
  because NOW reports operating cash flow as YTD only (Q1 is the sole discrete quarter). Do NOT revert
  to a naive "sum latest 4 quarters" for cash flow — it silently mixes four years' Q1s (gave a wrong
  ~42% FCF margin; correct is ~33%).
- **The Modeler ("Model it") is the reverse DCF** (`lib/dcf.ts` `runDcf` + `solveImpliedGrowth`),
  seeded live from `/api/overview` (revenue, current FCF margin, net cash, shares). Five sliders
  (year-1 growth, terminal growth, terminal FCF margin, WACC, perpetuity), three scenario presets
  (conservative/consensus/ambitious), and a big "solve for the growth today's price implies" button.
  Output is implied fair value/share, the gap vs the live price, the live implied year-1 growth, a
  10-year projected-FCF chart, and a value-breakdown line. (It replaced an earlier simple 5-year
  multiple model.) The peer/daily-move libs remain in the tree (tested) but are not wired to a page.
- **History line** = a vetted, labeled "approximate split-adjusted annual closes" snapshot
  (`lib/history.ts`) with the live current price appended — the only intentionally-static series.

The Phase-1 notes below are retained for historical context; where they conflict with the above, the
above wins.

## UI / design decisions (Phase 1 build — superseded by the 2026-06 redesign above)

Decisions made while building the homepage + reverse-DCF page. Keep these consistent across new pages.

- **Color scheme — "editorial ink + teal."** Warm off-white paper background, near-black ink text,
  teal accent. Defined as reusable tokens in `src/app/globals.css` (`@theme`): `paper` (#fbfaf7),
  `ink` (#1a1a18), `muted` (#5f5e5a), `line` (#e4e1d8), `stone-soft` (#f1efe8), `teal` (#0f6e56),
  `teal-bright` (#1d9e75), `teal-soft` (#e1f5ee). Use these utilities (`text-ink`, `bg-paper`,
  `border-line`, `text-teal`, …) — do NOT reintroduce slate/blue. Flat surfaces, no shadows.
  Charts: teal (#0f6e56) for the primary series, amber (#ba7517) for the secondary, grid `#e4e1d8`.
- **Shared top shell — `TopSection`** (`src/components/TopSection.tsx`). Headline → gap hero →
  the three section cards, rendered IDENTICALLY at the top of every page. Navigating between
  sections must leave this block unchanged; only the content below it swaps. New section pages
  render `<TopSection current="…" />` then their own content below.
- **Headline:** "Make sense of ServiceNow (NOW) stock" (a neutral umbrella over all three sections).
- **No global site header/nav bar.** Navigation is the three section cards in `SectionNav`
  (`src/components/SectionNav.tsx`); the current section renders as a non-link "you're here" card.
- **Gap hero** (`src/components/HomeHero.tsx`): implied fair value is computed live from
  `DEFAULT_INPUTS` + `NOW_COMPANY` (never hardcoded) beside the delayed quote. The gap is framed
  from the price's perspective relative to the implied value — e.g. "~40% below implied" (base =
  implied value, not price).
- **Neutral verdicts — no green/red.** Both the homepage gap and the reverse-DCF tool state the
  size/direction of the gap and what it implies about assumptions, but never color it good/bad
  (no buy/sell signal). Only a degenerate-input warning gets a distinct (amber) treatment.
- **Icons are inline SVG** (in `SectionNav.tsx`/`HomeHero.tsx`) — no icon-library dependency added.

## Phase 1 scope — three pages

1. **Daily move decomposition.** Splits NOW's daily move into market/sector beta vs. company-specific
   residual (e.g. "NOW fell 4%, software index fell 3%, so ~1% is company-specific"). Attaches a
   news-driven narrative ONLY when there is real, identifiable company news; otherwise says so plainly.
   The educational message — most daily moves are macro, not company news — is part of the point.
   During market hours, show figures as **provisional** (computed from the latest delayed price) and
   mark them **final after market close**. Include a short note explaining why the number shifts intraday.
2. **Reverse DCF / implied expectations (the centerpiece).** Starts from NOW's current market cap and
   backs out the growth/margin/terminal assumptions needed to justify it. Users adjust sliders and watch
   implied fair value move. Framing is always "given these assumptions, the market implies X," never
   "the market expects X."
3. **Valuation context.** Supporting multiples (EV/Revenue, P/E, Rule of 40) vs. NOW's own history and
   a few peers, to ground the reverse DCF.

Out of scope for Phase 1 (later phases): multiple tickers, real-time data, user accounts, email digests.

### Phase 1 build status — all three pages shipped

- **Price modeler** (`/reverse-dcf`) — the reverse-DCF tool. Card/title label is "Price modeler"
  (route + EDGAR/data still keyed to `reverse-dcf`/"implied expectations" internally). Live delayed
  price + client-side engine; number-line gap hero via `GapNumberLine`. Intro is a single teal CTA line.
- **Daily move** (`/daily-move`) — market/sector/company decomposition (`lib/dailyMove.ts`, exact
  identity assuming beta ≈ 1) served by `/api/daily-move`. Diverging-bar visual. "Why it moved" =
  EDGAR 8-Ks (authoritative) + Finnhub headlines (third-party, kept as-is by choice; quality is
  mixed — some headlines are loosely-related/recommendation-flavored, labeled as context).
- **Valuation context** (`/valuation`) — peer comparison via `/api/valuation`. Multiples chosen:
  **EV/Revenue, EV/FCF, Rule of 40** (GAAP P/E omitted — misleading for NOW's low GAAP earnings).
  Growth-vs-multiple scatter + table; peers CRM/WDAY/ADBE/DDOG. Page intentionally has NO
  per-page key-multiples card and NO EV/Rev history chart (both removed).

Data approach across pages: the share **price** is live (delayed, Finnhub) everywhere. For **NOW**,
`netCash` and `sharesOutstanding` are pulled **live from EDGAR** in the valuation route (see below).
**Peer** fundamentals (revenue, shares, net cash, growth, margin) are vetted static snapshots in
`lib/valuation.ts` — approximate, refresh from filings. The reverse-DCF page still uses the static
`NOW_COMPANY` figures (kept in sync with the live values) for its per-share math.

## The stock-split rule (critical — easy to get wrong)

ServiceNow executed a **5-for-1 stock split effective December 17, 2025**.
- Historical EDGAR share counts (~200M weighted diluted) are **pre-split**.
- Current share count (~1.03B) and current price (~$104) are **post-split**.
- **Never mix the two bases.** Doing so throws per-share math off by ~5x.
- The model avoids this by working in **market cap / enterprise value** (split-invariant) and only
  converting to per-share at the very end, using the **current post-split share count**.

## Data sources

### SEC EDGAR (fundamentals — free, public domain, redistributable)
- CIK: **0001373715**
- companyconcept endpoint pattern:
  `https://data.sec.gov/api/xbrl/companyconcept/CIK0001373715/us-gaap/{TAG}.json`
- **Validated GAAP tags (confirmed returning data):**
  - Revenue: `RevenueFromContractWithCustomerExcludingAssessedTax`
  - Operating income: `OperatingIncomeLoss`
  - Operating cash flow: `NetCashProvidedByUsedInOperatingActivities`
  - CapEx (subtract from OCF for FCF): `PaymentsToAcquirePropertyPlantAndEquipment`
  - Diluted shares: `WeightedAverageNumberOfDilutedSharesOutstanding` (units keyed by `shares`, not USD)
  - Cash: `CashAndCashEquivalentsAtCarryingValue`
  - Short-term investments: `AvailableForSaleSecuritiesDebtSecuritiesCurrent`
  - Long-term investments: `AvailableForSaleSecuritiesDebtSecuritiesNoncurrent`
  - Shares outstanding: `dei:EntityCommonStockSharesOutstanding` (dei taxonomy, units `shares`;
    fallback `us-gaap:CommonStockSharesOutstanding`). Take the LATEST point — older points are pre-split.
  - **Debt:** NOW currently reports essentially NO financial debt — its old convertible-note tags
    (`LongTermDebtNoncurrent`, etc.) went stale ~2022. Net cash ≈ cash + investments.
- **Live wiring (server-side, cached ~1 day):** `lib/edgar.ts` `fetchNetCash()` and
  `fetchSharesOutstanding()` compute NOW's net cash (cash + marketable securities − debt) and shares
  from the tags above, anchoring on the latest balance-sheet date so stale/pre-split values drop out.
  Used by `/api/valuation` so NOW's EV is fully live (price × live shares − live net cash). Peers are
  NOT wired (would need each peer's CIK + balance-sheet tags). Balance-sheet items are INSTANT (single
  `end` date, no period) — different from the flow concepts (revenue, etc.) that need start/end logic.
- **EDGAR parsing gotcha:** each data point has `start` and `end`. Always check BOTH — period length
  = end − start. 3 months = single quarter; 12 months = full year; 6/9 months = year-to-date cumulative
  (usually exclude to avoid double-counting). Cash-flow figures are especially prone to YTD accumulation.
- **EDGAR from code requires a `User-Agent` header** with a name and email, or requests get a 403.

### Price data (delayed quotes)
- Provider under evaluation: Finnhub / Twelve Data / Alpha Vantage (free tiers).
- Delay is provider-dependent (~real-time to 20 min on free tiers); spec it as "delayed," not exactly 15 min.
- For decomposition, also pull a market proxy (e.g. SPY) and a software-sector proxy (e.g. IGV).
- **Licensing: before public launch, verify the chosen provider's terms allow public DISPLAY/redistribution
  of quotes.** EDGAR has no such restriction; price APIs often do.

## The reverse-DCF model (already validated in a spreadsheet + prototype)

Engine logic — preserve exactly when implementing:
- Revenue grows from a starting TTM base; **Year-1 growth fades linearly to a terminal growth rate by
  the end of a 10-year horizon.**
- **FCF margin ramps linearly** from the current FCF margin to a target terminal margin by Year 10.
- Each year: FCF = revenue × FCF margin; discount at WACC.
- Terminal value via Gordon growth: `lastFCF × (1 + perpetuity) / (WACC − perpetuity)`, then discounted.
- Enterprise value = sum of PV(FCF) + PV(terminal value).
- Equity value = EV + net cash (NOW is in a NET CASH position: cash > debt, so this ADDS to equity value).
- Implied fair value per share = equity value / current post-split share count.

Five user-adjustable inputs (sliders): Year-1 revenue growth, terminal growth, terminal FCF margin,
WACC, perpetuity growth. Include a "solve for implied growth" feature (binary search for the Year-1
growth that makes fair value = current price).

UI principles learned during prototyping:
- The **hero is the gap** between implied fair value and current price, with a plain-English verdict.
- Benchmarks sit beside each slider as **static reference text** (no color-change behavior — it confused
  users). Company-specific benchmarks (growth, margin) come from filings; the other three (terminal growth,
  WACC, perpetuity) are convention-based ranges — it's honest to distinguish these.
- Charts need explicit titles, subtitles, and axis labels — don't rely on hover/tooltips for identification.

## Reference figures (refresh from filings; approximate, post-split where per-share)

- FY24 revenue: ~$10.98B. FY25 revenue: ~$13.3B (~21% YoY). TTM revenue ~$14B.
- FY25 FCF margin ~31% (management targeting ~35%).
- ~1.03B shares outstanding (post-split). Net cash position (cash > debt).
- Recent quarterly revenue growth has run ~20–22% YoY; cRPO growth ~22%.

## Working style

- Author is new to web development but can copy/paste commands and read explanations.
- Explain decisions and tradeoffs; prefer teaching over silently doing.
- Validate at each step before moving on.
- Ask before introducing new dependencies or anything that touches the hard rules above.
