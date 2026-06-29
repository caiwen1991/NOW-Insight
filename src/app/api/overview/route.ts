/**
 * Single live-data route for the "NOW you know" landing page.
 *
 * Fuses three PUBLIC sources, all server-side (Finnhub key never reaches the browser — CLAUDE.md):
 *  - Finnhub quote        → price, change, % change, as-of
 *  - Finnhub basic-financials metric → 52-week range, trailing P/E
 *  - SEC EDGAR            → TTM revenue, reported YoY growth, FCF margin, shares, net cash
 *
 * Everything the page renders is derived here from those sources. Each source degrades
 * independently: if one is unavailable we fall back to the vetted figures in lib/company.ts and
 * flag it in `notes` + the relevant `*Source` field, rather than failing the whole response.
 *
 * Derived figures (market cap, FCF, P/S, P/FCF, the "priced-in" split) are computed from
 * live price × live shares so they move with the market. No displayed number is hardcoded;
 * the only fallback values are the clearly-flagged vetted constants.
 */

import { NextResponse } from "next/server";
import { TICKER, NOW_COMPANY } from "@/lib/company";
import { fetchFundamentals, fetchNetCash, fetchSharesOutstanding } from "@/lib/edgar";

export const dynamic = "force-dynamic";

type FieldSource = "live" | "fallback";

export interface OverviewPayload {
  ticker: string;
  asOf: number;
  delayed: true;

  // --- Live quote ---
  price: number;
  change: number | null;
  changePercent: number | null;
  /** True when price is the vetted placeholder, not a live quote. */
  priceIsPlaceholder: boolean;

  // --- Market stats ---
  /** Market cap in $B (price × shares). */
  marketCap: number;
  /** Intraday high for the current session (Finnhub quote `h`). */
  dayHigh: number | null;
  /** Intraday low for the current session (Finnhub quote `l`). */
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  peTtm: number | null;

  // --- Fundamentals ($B / decimals / billions of shares) ---
  revenueTtm: number;
  fcfMargin: number;
  /** Reported YoY revenue growth (decimal). Null if EDGAR couldn't supply prior-year TTM. */
  revenueGrowthYoY: number | null;
  shares: number;
  netCash: number;

  // --- Derived ---
  /** Free cash flow (TTM), $B = revenueTtm × fcfMargin. */
  fcf: number;
  /** Market cap ÷ revenue (a P/S proxy). */
  priceToSales: number;
  /** Market cap ÷ FCF. */
  priceToFcf: number;
  /** "Proven business today" value, $B ≈ trailing FCF × a no-growth 15× multiple. */
  provenValue: number;
  /** "Future growth premium", $B = marketCap − provenValue (floored at 0). */
  growthValue: number;
  /** Growth premium as a share of market cap (decimal). */
  growthShare: number;

  // Provenance so the UI can label what's live vs. vetted-fallback.
  sources: {
    price: FieldSource;
    shares: FieldSource;
    netCash: FieldSource;
    revenue: FieldSource;
    fcfMargin: FieldSource;
    week52: FieldSource;
    pe: FieldSource;
  };
  /** Freshness label for fundamentals (EDGAR anchor date when live). */
  fundamentalsAsOf: string;
  notes: string[];
}

/** No-growth multiple used to value the "proven business today" slice (teaching split, not a valuation). */
const NO_GROWTH_FCF_MULTIPLE = 15;
/** Reference price used only if no live quote is available (~post-split level). */
const PLACEHOLDER_PRICE = 104;

interface FinnhubQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number | null;
  l: number | null;
  t: number;
}

interface FinnhubMetric {
  metric?: Record<string, number | null>;
}

async function fetchQuote(apiKey: string): Promise<FinnhubQuote | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${TICKER}&token=${apiKey}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return null;
    const q = (await res.json()) as FinnhubQuote;
    return q && typeof q.c === "number" && q.c > 0 ? q : null;
  } catch {
    return null;
  }
}

async function fetchMetric(apiKey: string): Promise<FinnhubMetric["metric"] | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${TICKER}&metric=all&token=${apiKey}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as FinnhubMetric;
    return j && j.metric ? j.metric : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  const notes: string[] = [];

  const [quote, metric, fundamentals, netCashRes, sharesRes] = await Promise.all([
    apiKey ? fetchQuote(apiKey) : Promise.resolve(null),
    apiKey ? fetchMetric(apiKey) : Promise.resolve(null),
    fetchFundamentals(),
    fetchNetCash(),
    fetchSharesOutstanding(),
  ]);

  if (!apiKey) notes.push("No FINNHUB_API_KEY configured — price, 52-week range and P/E are unavailable.");
  else if (!quote) notes.push("Live quote unavailable — showing a flagged placeholder price.");

  // --- Quote ---
  const priceIsPlaceholder = !quote;
  const price = quote?.c ?? PLACEHOLDER_PRICE;
  const change = quote?.d ?? null;
  const changePercent = quote?.dp != null ? quote.dp / 100 : null;

  // --- Fundamentals (live EDGAR, else vetted constants) ---
  if (!fundamentals) notes.push("EDGAR fundamentals unavailable — using vetted revenue/margin figures.");
  if (!sharesRes) notes.push("EDGAR shares unavailable — using the vetted share count.");
  if (!netCashRes) notes.push("EDGAR net cash unavailable — using the vetted net-cash figure.");

  const revenueTtm = fundamentals?.revenueTtm ?? NOW_COMPANY.ttmRevenue;
  const fcfMargin = fundamentals?.fcfMargin ?? NOW_COMPANY.currentFcfMargin;
  const revenueGrowthYoY = fundamentals?.revenueGrowthYoY ?? null;
  const shares = sharesRes?.shares ?? NOW_COMPANY.sharesOutstanding;
  const netCash = netCashRes?.netCash ?? NOW_COMPANY.netCash;

  // --- Market stats ---
  const marketCap = price * shares; // $B (price $ × shares in billions)
  const dayHigh = num(quote?.h);
  const dayLow = num(quote?.l);
  const week52High = num(metric?.["52WeekHigh"]);
  const week52Low = num(metric?.["52WeekLow"]);
  const peTtm = num(metric?.["peTTM"]) ?? num(metric?.["peBasicExclExtraTTM"]);

  // --- Derived ---
  const fcf = revenueTtm * fcfMargin;
  const priceToSales = marketCap / revenueTtm;
  const priceToFcf = fcf > 0 ? marketCap / fcf : NaN;
  const provenValue = Math.min(fcf * NO_GROWTH_FCF_MULTIPLE, marketCap);
  const growthValue = Math.max(marketCap - provenValue, 0);
  const growthShare = marketCap > 0 ? growthValue / marketCap : 0;

  const payload: OverviewPayload = {
    ticker: TICKER,
    asOf: quote?.t ? quote.t * 1000 : Date.now(),
    delayed: true,

    price,
    change,
    changePercent,
    priceIsPlaceholder,

    marketCap,
    dayHigh,
    dayLow,
    week52High,
    week52Low,
    peTtm,

    revenueTtm,
    fcfMargin,
    revenueGrowthYoY,
    shares,
    netCash,

    fcf,
    priceToSales,
    priceToFcf,
    provenValue,
    growthValue,
    growthShare,

    sources: {
      price: priceIsPlaceholder ? "fallback" : "live",
      shares: sharesRes ? "live" : "fallback",
      netCash: netCashRes ? "live" : "fallback",
      revenue: fundamentals ? "live" : "fallback",
      fcfMargin: fundamentals?.fcfMargin != null ? "live" : "fallback",
      week52: week52High != null && week52Low != null ? "live" : "fallback",
      pe: peTtm != null ? "live" : "fallback",
    },
    fundamentalsAsOf: fundamentals?.asOf ?? "vetted snapshot",
    notes,
  };

  return NextResponse.json(payload);
}

/** Coerce a Finnhub metric field to a positive finite number, else null. */
function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
