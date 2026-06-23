/**
 * Valuation-multiples engine + vetted peer/history dataset for the Valuation context page.
 *
 * Pure module — no React, no I/O. The route supplies a live (delayed) price per company; everything
 * else (revenue, shares, net cash, growth, FCF margin) is a vetted PUBLIC snapshot hard-coded here
 * and refreshed manually — the same pattern lib/company.ts uses. Multiples are computed from
 * live price × these fundamentals, so EV/Revenue and EV/FCF move with the market.
 *
 * Units: revenue & net cash in $B, shares in billions. All figures POST-SPLIT where per-share.
 *
 * ⚠️ Peer and history figures are APPROXIMATE — refresh from each company's latest filings before
 * relying on them. They are here to give context (where NOW sits), not precise valuations.
 */

import { NOW_COMPANY, TICKER, FUNDAMENTALS_AS_OF } from "./company";

export interface CompanyFundamentals {
  symbol: string;
  name: string;
  /** Trailing-twelve-month revenue, $B. */
  revenueTtm: number;
  /** Shares outstanding, billions. */
  shares: number;
  /** Net cash (cash − debt), $B. Positive = net cash; negative = net debt. */
  netCash: number;
  /** Recent YoY revenue growth (decimal). */
  revenueGrowth: number;
  /** FCF margin (decimal). */
  fcfMargin: number;
  /** Freshness label for the fundamentals. */
  asOf: string;
}

export interface Multiples {
  marketCap: number; // $B
  ev: number; // $B
  evRevenue: number;
  evFcf: number; // NaN if FCF ≤ 0
  ruleOf40: number; // percentage points (growth% + margin%)
  revenueGrowth: number; // decimal (passthrough, for charts)
  fcfMargin: number; // decimal (passthrough)
}

/** Compute valuation multiples from a live price and a company's fundamentals. */
export function computeMultiples(price: number, f: CompanyFundamentals): Multiples {
  const marketCap = price * f.shares;
  const ev = marketCap - f.netCash; // net cash REDUCES EV
  const fcf = f.revenueTtm * f.fcfMargin;
  return {
    marketCap,
    ev,
    evRevenue: ev / f.revenueTtm,
    evFcf: fcf > 0 ? ev / fcf : NaN,
    ruleOf40: (f.revenueGrowth + f.fcfMargin) * 100,
    revenueGrowth: f.revenueGrowth,
    fcfMargin: f.fcfMargin,
  };
}

/** NOW's own fundamentals, sourced from lib/company.ts so the DCF and this page stay consistent. */
const NOW_FUNDAMENTALS: CompanyFundamentals = {
  symbol: TICKER,
  name: "ServiceNow",
  revenueTtm: NOW_COMPANY.ttmRevenue,
  shares: NOW_COMPANY.sharesOutstanding,
  netCash: NOW_COMPANY.netCash,
  revenueGrowth: 0.21, // ~FY25 YoY (CLAUDE.md reference)
  fcfMargin: NOW_COMPANY.currentFcfMargin,
  asOf: FUNDAMENTALS_AS_OF,
};

/**
 * NOW first, then the chosen peers. APPROXIMATE public figures — refresh from filings.
 * Peers: Salesforce, Workday, Adobe, Datadog (per project decision).
 */
export const COMPANIES: CompanyFundamentals[] = [
  NOW_FUNDAMENTALS,
  {
    symbol: "CRM",
    name: "Salesforce",
    revenueTtm: 39.0,
    shares: 0.96,
    netCash: 6.0,
    revenueGrowth: 0.09,
    fcfMargin: 0.33,
    asOf: "approx. — refresh from filings",
  },
  {
    symbol: "WDAY",
    name: "Workday",
    revenueTtm: 8.8,
    shares: 0.27,
    netCash: 4.0,
    revenueGrowth: 0.15,
    fcfMargin: 0.26,
    asOf: "approx. — refresh from filings",
  },
  {
    symbol: "ADBE",
    name: "Adobe",
    revenueTtm: 22.5,
    shares: 0.43,
    netCash: 3.0,
    revenueGrowth: 0.1,
    fcfMargin: 0.37,
    asOf: "approx. — refresh from filings",
  },
  {
    symbol: "DDOG",
    name: "Datadog",
    revenueTtm: 3.0,
    shares: 0.35,
    netCash: 3.0,
    revenueGrowth: 0.25,
    fcfMargin: 0.28,
    asOf: "approx. — refresh from filings",
  },
];

/**
 * NOW's EV/Revenue at recent fiscal year-ends — a vetted, APPROXIMATE snapshot series to show the
 * multiple's trend over time. Refresh from filings/market data. The live current point is appended
 * by the page from today's price.
 */
export const NOW_EVREV_HISTORY: { label: string; evRevenue: number }[] = [
  { label: "FY21", evRevenue: 22 },
  { label: "FY22", evRevenue: 16 },
  { label: "FY23", evRevenue: 13 },
  { label: "FY24", evRevenue: 10 },
  { label: "FY25", evRevenue: 8 },
];
