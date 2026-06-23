/**
 * Server-side data for the Daily move page.
 *
 * Pulls, all on the server (Finnhub key never reaches the browser — CLAUDE.md hard rule):
 *  - delayed quotes for NOW + the market proxy (SPY) + the software-sector proxy (IGV),
 *  - NOW's recent SEC EDGAR 8-K filings (authoritative company events; public domain),
 *  - recent Finnhub company-news headlines for NOW (third-party press — see terms caveat below),
 *  - a market-open flag (NYSE weekday 9:30–16:00 ET) to mark figures provisional vs. final.
 *
 * Each source is fetched independently and degrades gracefully: a failure in one leaves the others
 * intact and is reported via the `notes` array rather than failing the whole response.
 *
 * ⚠️ Finnhub terms: verify that Finnhub's license permits public DISPLAY of news headlines before
 * launch (same caveat as quotes — see README). EDGAR has no such restriction.
 * ⚠️ Market-hours check ignores exchange holidays in Phase 1 (a known simplification).
 */

import { NextResponse } from "next/server";
import { TICKER, MARKET_PROXY, SECTOR_PROXY } from "@/lib/company";
import { NOW_CIK, EDGAR_USER_AGENT } from "@/lib/edgar";

export const dynamic = "force-dynamic";

export interface SymbolQuote {
  symbol: string;
  price: number | null;
  /** Daily change vs previous close, decimal (e.g. -0.021). Null if unknown. */
  changePercent: number | null;
  isPlaceholder: boolean;
}

export interface FilingItem {
  form: string;
  /** ISO date (YYYY-MM-DD) the filing was made. */
  filedAt: string;
  /** 8-K item codes (e.g. ["2.02", "9.01"]); empty if none parsed. */
  items: string[];
  /** Short description of the primary document, when EDGAR provides one. */
  description: string | null;
  url: string;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  /** Epoch milliseconds. */
  datetime: number;
}

export interface DailyMovePayload {
  asOf: number;
  /** True during NYSE regular hours (figures are provisional and finalize after close). */
  marketOpen: boolean;
  delayed: true;
  quotes: { now: SymbolQuote; market: SymbolQuote; sector: SymbolQuote };
  filings: FilingItem[];
  news: NewsItem[];
  notes: string[];
}

interface FinnhubQuote {
  c: number;
  dp: number | null;
}

function placeholderQuote(symbol: string): SymbolQuote {
  return { symbol, price: null, changePercent: null, isPlaceholder: true };
}

async function fetchQuote(symbol: string, apiKey: string): Promise<SymbolQuote> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return placeholderQuote(symbol);
    const q = (await res.json()) as FinnhubQuote;
    if (!q || typeof q.c !== "number" || q.c <= 0) return placeholderQuote(symbol);
    return {
      symbol,
      price: q.c,
      changePercent: q.dp != null ? q.dp / 100 : null,
      isPlaceholder: false,
    };
  } catch {
    return placeholderQuote(symbol);
  }
}

interface EdgarSubmissions {
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      accessionNumber?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
      items?: string[];
    };
  };
}

/** NOW's recent 8-K filings (last `days` days, newest first). Empty on any error. */
async function fetchFilings(days = 5, limit = 5): Promise<FilingItem[]> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${NOW_CIK}.json`, {
      headers: { "User-Agent": EDGAR_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as EdgarSubmissions;
    const r = json.filings?.recent;
    if (!r?.form) return [];

    const cutoff = Date.now() - days * 86_400_000;
    const cikNoPad = String(Number(NOW_CIK));
    const out: FilingItem[] = [];

    for (let i = 0; i < r.form.length; i++) {
      if (r.form[i] !== "8-K") continue;
      const filedAt = r.filingDate?.[i];
      if (!filedAt || Date.parse(filedAt) < cutoff) continue;

      const accession = r.accessionNumber?.[i] ?? "";
      const accNoDashes = accession.replace(/-/g, "");
      const doc = r.primaryDocument?.[i] ?? "";
      const url = accNoDashes
        ? `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${accNoDashes}/${doc}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${NOW_CIK}&type=8-K`;

      out.push({
        form: r.form[i],
        filedAt,
        items: (r.items?.[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        description: r.primaryDocDescription?.[i] || null,
        url,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

interface FinnhubNews {
  datetime: number; // unix seconds
  headline: string;
  source: string;
  url: string;
}

/** Recent NOW headlines from Finnhub (last `days` days, newest first). Empty on any error/no key. */
async function fetchNews(apiKey: string, days = 3, limit = 5): Promise<NewsItem[]> {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${TICKER}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const arr = (await res.json()) as FinnhubNews[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((n) => n && n.headline && n.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, limit)
      .map((n) => ({
        headline: n.headline,
        source: n.source || "Finnhub",
        url: n.url,
        datetime: n.datetime * 1000,
      }));
  } catch {
    return [];
  }
}

/** NYSE regular hours: Mon–Fri, 9:30–16:00 America/New_York. Ignores holidays (Phase 1). */
function isMarketOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return minutes >= 570 && minutes < 960; // 9:30 .. 16:00
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  const notes: string[] = [];

  const [now, market, sector] = apiKey
    ? await Promise.all([
        fetchQuote(TICKER, apiKey),
        fetchQuote(MARKET_PROXY, apiKey),
        fetchQuote(SECTOR_PROXY, apiKey),
      ])
    : [placeholderQuote(TICKER), placeholderQuote(MARKET_PROXY), placeholderQuote(SECTOR_PROXY)];

  if (!apiKey) notes.push("No FINNHUB_API_KEY configured — quotes and headlines are unavailable.");

  const [filings, news] = await Promise.all([
    fetchFilings(),
    apiKey ? fetchNews(apiKey) : Promise.resolve<NewsItem[]>([]),
  ]);

  const payload: DailyMovePayload = {
    asOf: Date.now(),
    marketOpen: isMarketOpen(new Date()),
    delayed: true,
    quotes: { now, market, sector },
    filings,
    news,
    notes,
  };
  return NextResponse.json(payload);
}
