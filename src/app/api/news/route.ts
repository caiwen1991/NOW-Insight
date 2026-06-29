/**
 * Recent-news route for the "What just happened" section.
 *
 * Source: Finnhub `company-news` for NOW over the last week (free tier; key read server-side from
 * FINNHUB_API_KEY, never sent to the browser). We surface a handful of the most recent, de-duplicated
 * headlines as third-party CONTEXT — not the site's voice.
 *
 * CLAUDE.md hard rule: "No buy/sell recommendations." Finnhub's feed is heavy on analyst-rating /
 * price-target headlines; relaying those would read as recommendations, so they're filtered out
 * (RATING_RE). What remains is news (product launches, partnerships, earnings, etc.).
 */
import { NextResponse } from "next/server";
import { TICKER } from "@/lib/company";

export const dynamic = "force-dynamic";

export interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  /** Publish time, epoch ms. */
  datetime: number;
}

export interface NewsPayload {
  items: NewsItem[];
  asOf: number;
  source: "live" | "unavailable";
  note?: string;
}

interface FinnhubNews {
  datetime: number; // epoch seconds
  headline: string;
  id: number;
  source: string;
  summary: string;
  url: string;
}

const DAYS = 7;
const MAX_ITEMS = 6;

/**
 * Analyst-rating / recommendation-flavored headlines to exclude (honors the no-buy/sell rule).
 * Kept targeted so genuine company news isn't over-filtered.
 */
const RATING_RE =
  /(price target|\bPT\b|upgrade|downgrade|reiterat|initiat\w*\s+coverage|maintains?\s+(buy|sell|hold|overweight|underweight|neutral)|\b(buy|sell|hold|overweight|underweight|outperform|underperform)\s+rating|raises?\s+(price\s+)?target|cuts?\s+(price\s+)?target|top\s+(pick|stock)|stocks?\s+to\s+(buy|watch)|best\s+stock)/i;

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchNews(apiKey: string): Promise<FinnhubNews[] | null> {
  const to = Date.now();
  const from = to - DAYS * 86_400_000;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${TICKER}&from=${ymd(from)}&to=${ymd(to)}&token=${apiKey}`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j) ? (j as FinnhubNews[]) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json<NewsPayload>({ items: [], asOf: Date.now(), source: "unavailable", note: "No FINNHUB_API_KEY configured." });
  }

  const raw = await fetchNews(apiKey);
  if (!raw) {
    return NextResponse.json<NewsPayload>({ items: [], asOf: Date.now(), source: "unavailable", note: "News unavailable." });
  }

  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const n of raw.slice().sort((a, b) => b.datetime - a.datetime)) {
    if (!n.headline || !n.url) continue;
    if (RATING_RE.test(n.headline)) continue;
    const key = n.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: n.id,
      headline: n.headline,
      summary: n.summary ?? "",
      source: n.source ?? "",
      url: n.url,
      datetime: n.datetime * 1000,
    });
    if (items.length >= MAX_ITEMS) break;
  }

  return NextResponse.json<NewsPayload>({ items, asOf: Date.now(), source: "live" });
}
