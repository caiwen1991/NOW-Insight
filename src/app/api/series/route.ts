/**
 * Price-history route for the hero trend chart.
 *
 * Twelve Data `time_series` is the source (free tier). The API key is read server-side from
 * TWELVE_DATA_API_KEY and NEVER reaches the browser (same rule as the Finnhub key — CLAUDE.md).
 * One request per timeframe; we normalise to a compact ascending [{ t, c }] series of closes.
 *
 * Split note (CLAUDE.md): NOW did a 5-for-1 split on 2025-12-17. The post-split timeframes
 * (1D…YTD) never cross it. The longer ones (1Y/5Y/MAX) do — Twelve Data returns split-adjusted
 * history, so the line should be continuous; if a ~5× cliff ever appears at Dec 2025, the provider
 * stopped adjusting and we'd need to back-adjust here.
 */
import { NextResponse } from "next/server";
import { TICKER } from "@/lib/company";

export const dynamic = "force-dynamic";

const RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

interface SeriesPoint {
  /** Epoch milliseconds. */
  t: number;
  /** Close price (post-split dollars). */
  c: number;
}

export interface SeriesPayload {
  range: Range;
  points: SeriesPoint[];
  source: "live" | "unavailable";
  note?: string;
}

/** Twelve Data interval + how many bars to pull for each timeframe. */
const CONFIG: Record<Range, { interval: string; outputsize: number; revalidate: number }> = {
  "1D": { interval: "5min", outputsize: 400, revalidate: 60 },
  "1W": { interval: "30min", outputsize: 400, revalidate: 300 },
  "1M": { interval: "1day", outputsize: 25, revalidate: 3600 },
  "3M": { interval: "1day", outputsize: 70, revalidate: 3600 },
  "YTD": { interval: "1day", outputsize: 260, revalidate: 3600 },
  "1Y": { interval: "1day", outputsize: 260, revalidate: 3600 },
  "5Y": { interval: "1week", outputsize: 270, revalidate: 86400 },
  "MAX": { interval: "1month", outputsize: 260, revalidate: 86400 },
};

interface TwelveValue {
  datetime: string;
  close: string;
}
interface TwelveResponse {
  status?: string;
  values?: TwelveValue[];
  message?: string;
}

/** Parse Twelve Data's "YYYY-MM-DD[ HH:MM:SS]" (already in the requested timezone) to epoch ms. */
function parseDatetime(s: string): number {
  // Treat as America/New_York wall-clock; the exact offset doesn't matter for plotting order/spacing.
  return new Date(s.replace(" ", "T")).getTime();
}

/** Keep only the points the timeframe should actually show (intraday windows + YTD). */
function trim(range: Range, points: SeriesPoint[]): SeriesPoint[] {
  if (points.length === 0) return points;
  const last = points[points.length - 1].t;
  const DAY = 86_400_000;
  if (range === "1D") {
    // Just the latest session: same calendar day as the most recent bar.
    const lastDay = new Date(last).toDateString();
    return points.filter((p) => new Date(p.t).toDateString() === lastDay);
  }
  if (range === "1W") return points.filter((p) => p.t >= last - 7 * DAY);
  if (range === "YTD") {
    const jan1 = new Date(new Date(last).getFullYear(), 0, 1).getTime();
    return points.filter((p) => p.t >= jan1);
  }
  return points;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") as Range | null;
  const range: Range = rangeParam && RANGES.includes(rangeParam) ? rangeParam : "1D";

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json<SeriesPayload>({
      range,
      points: [],
      source: "unavailable",
      note: "No TWELVE_DATA_API_KEY configured.",
    });
  }

  const { interval, outputsize, revalidate } = CONFIG[range];
  const api = new URL("https://api.twelvedata.com/time_series");
  api.searchParams.set("symbol", TICKER);
  api.searchParams.set("interval", interval);
  api.searchParams.set("outputsize", String(outputsize));
  api.searchParams.set("order", "ASC");
  api.searchParams.set("timezone", "America/New_York");
  api.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(api, { next: { revalidate } });
    if (!res.ok) {
      return NextResponse.json<SeriesPayload>({ range, points: [], source: "unavailable", note: `HTTP ${res.status}` });
    }
    const json = (await res.json()) as TwelveResponse;
    if (json.status === "error" || !Array.isArray(json.values)) {
      return NextResponse.json<SeriesPayload>({
        range,
        points: [],
        source: "unavailable",
        note: json.message ?? "Twelve Data returned no series.",
      });
    }

    const points: SeriesPoint[] = json.values
      .map((v) => ({ t: parseDatetime(v.datetime), c: Number(v.close) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0);

    return NextResponse.json<SeriesPayload>({ range, points: trim(range, points), source: "live" });
  } catch {
    return NextResponse.json<SeriesPayload>({ range, points: [], source: "unavailable", note: "Fetch failed." });
  }
}
