/**
 * Server-side data for the Valuation context page.
 *
 * Fetches a live (delayed) price for NOW and each peer (Finnhub key stays server-side — CLAUDE.md
 * hard rule), then computes EV/Revenue, EV/FCF, and Rule of 40 from each company's vetted
 * fundamentals (lib/valuation.ts). Companies whose price can't be fetched are returned with
 * `isPlaceholder: true` and null multiples so the page can show what it has.
 */

import { NextResponse } from "next/server";
import { COMPANIES, computeMultiples, type Multiples } from "@/lib/valuation";
import { fetchNetCash, fetchSharesOutstanding } from "@/lib/edgar";

export const dynamic = "force-dynamic";

export interface CompanyValuation {
  symbol: string;
  name: string;
  price: number | null;
  isPlaceholder: boolean;
  /** Null when no live price was available. */
  multiples: Multiples | null;
  asOf: string;
  /** Net cash ($B) used in this company's EV. */
  netCash: number;
  /** Balance-sheet date if net cash was pulled live from EDGAR (NOW only); null if static. */
  netCashAsOf: string | null;
  /** Date if shares outstanding was pulled live from EDGAR (NOW only); null if static. */
  sharesAsOf: string | null;
}

export interface ValuationPayload {
  asOf: number;
  delayed: true;
  companies: CompanyValuation[];
  notes: string[];
}

interface FinnhubQuote {
  c: number;
}

async function fetchPrice(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const q = (await res.json()) as FinnhubQuote;
    return q && typeof q.c === "number" && q.c > 0 ? q.c : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  const notes: string[] = [];
  if (!apiKey) notes.push("No FINNHUB_API_KEY configured — live multiples are unavailable.");

  // NOW's net cash + shares, live from EDGAR (override its static figures). Peers stay static.
  const [liveNetCash, liveShares] = await Promise.all([fetchNetCash(), fetchSharesOutstanding()]);
  if (!liveNetCash) notes.push("NOW net cash: EDGAR unavailable — using the vetted static figure.");
  if (!liveShares) notes.push("NOW shares: EDGAR unavailable — using the vetted static figure.");

  const companies: CompanyValuation[] = await Promise.all(
    COMPANIES.map(async (base) => {
      const isNow = base.symbol === "NOW";
      const f = isNow
        ? {
            ...base,
            netCash: liveNetCash?.netCash ?? base.netCash,
            shares: liveShares?.shares ?? base.shares,
          }
        : base;
      const price = apiKey ? await fetchPrice(f.symbol, apiKey) : null;
      return {
        symbol: f.symbol,
        name: f.name,
        price,
        isPlaceholder: price == null,
        multiples: price != null ? computeMultiples(price, f) : null,
        asOf: f.asOf,
        netCash: f.netCash,
        netCashAsOf: isNow && liveNetCash ? liveNetCash.asOf : null,
        sharesAsOf: isNow && liveShares ? liveShares.asOf : null,
      };
    })
  );

  const payload: ValuationPayload = {
    asOf: Date.now(),
    delayed: true,
    companies,
    notes,
  };
  return NextResponse.json(payload);
}
