/**
 * Server-side delayed-quote route for NOW.
 *
 * The Finnhub API key is read from `process.env.FINNHUB_API_KEY` and used ONLY here, on the server.
 * It is never sent to the browser (CLAUDE.md hard rule: API keys server-side only).
 *
 * Quotes on free tiers are DELAYED (provider-dependent, ~real-time to ~20 min). We label them
 * "delayed" rather than claiming an exact lag.
 *
 * ⚠️ Before public launch, verify Finnhub's terms allow public DISPLAY of quotes (see README).
 *
 * If no key is configured (or the upstream call fails), we return a clearly-flagged placeholder
 * price so the page still functions in development. The flag drives a visible "placeholder" label.
 */

import { NextResponse } from "next/server";
import { TICKER } from "@/lib/company";

// Don't statically cache; revalidate the upstream fetch on a short interval instead.
export const dynamic = "force-dynamic";

/** Plain, public reference price used only when no live quote is available. ~post-split level. */
const PLACEHOLDER_PRICE = 104;

export interface QuotePayload {
  ticker: string;
  /** Latest price in USD. */
  price: number;
  /** Absolute change vs previous close, USD (null if unknown). */
  change: number | null;
  /** Percent change vs previous close, decimal (null if unknown). */
  changePercent: number | null;
  /** Previous close, USD (null if unknown). */
  previousClose: number | null;
  /** Epoch milliseconds the quote is as-of. */
  asOf: number;
  /** Quotes are delayed on free tiers. */
  delayed: true;
  /** Where the number came from. */
  source: "finnhub" | "placeholder";
  /** True when this is the fallback reference price, not a live quote. */
  isPlaceholder: boolean;
}

interface FinnhubQuote {
  c: number; // current price
  d: number | null; // change
  dp: number | null; // percent change
  pc: number; // previous close
  t: number; // unix seconds
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(placeholder("no FINNHUB_API_KEY configured"));
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${TICKER}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) {
      return NextResponse.json(placeholder(`finnhub ${res.status}`));
    }
    const q = (await res.json()) as FinnhubQuote;

    // Finnhub returns c === 0 for unknown/invalid symbols — treat that as a miss.
    if (!q || typeof q.c !== "number" || q.c <= 0) {
      return NextResponse.json(placeholder("finnhub returned no price"));
    }

    const payload: QuotePayload = {
      ticker: TICKER,
      price: q.c,
      change: q.d ?? null,
      changePercent: q.dp != null ? q.dp / 100 : null,
      previousClose: typeof q.pc === "number" ? q.pc : null,
      asOf: q.t ? q.t * 1000 : timestampMs(),
      delayed: true,
      source: "finnhub",
      isPlaceholder: false,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(placeholder(err instanceof Error ? err.message : "fetch failed"));
  }
}

/** Build a clearly-flagged placeholder payload. The `reason` aids debugging (server logs only). */
function placeholder(reason: string): QuotePayload {
  console.warn(`[quote] using placeholder price: ${reason}`);
  return {
    ticker: TICKER,
    price: PLACEHOLDER_PRICE,
    change: null,
    changePercent: null,
    previousClose: null,
    asOf: timestampMs(),
    delayed: true,
    source: "placeholder",
    isPlaceholder: true,
  };
}

function timestampMs(): number {
  return new Date().getTime();
}
