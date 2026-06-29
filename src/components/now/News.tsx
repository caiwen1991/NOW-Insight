"use client";

/**
 * "What just happened" — the most recent ServiceNow headlines from the past week, via /api/news
 * (Finnhub company-news, server-side). Presented as third-party CONTEXT: every item is sourced,
 * timestamped, and links out; analyst-rating/price-target headlines are filtered server-side to
 * honor the no-buy/sell-recommendations rule. External links open in a new tab with noopener.
 */
import { useEffect, useState } from "react";

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
}

/** Compact relative age ("3h ago", "2 days ago"). */
function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function News() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/news")
      .then((r) => r.json())
      .then((d: { source?: string; items?: NewsItem[] }) => {
        if (cancelled) return;
        if (d?.source === "live" && Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items);
          setState("ready");
        } else {
          setState("empty");
        }
      })
      .catch(() => {
        if (!cancelled) setState("empty");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="block" id="news" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">In the news</div>
          <h2>What just happened</h2>
          <p className="lede">The most recent ServiceNow headlines.</p>
        </div>

        {state === "loading" && <p className="news-status">Loading recent headlines…</p>}
        {state === "empty" && <p className="news-status">No recent headlines available right now.</p>}
        {state === "ready" && items && (
          <ol className="news-list">
            {items.map((it) => (
              <li key={it.id} className="news-item">
                <a className="news-link" href={it.url} target="_blank" rel="noopener noreferrer">
                  <div className="news-meta">
                    {it.source && <span className="news-source">{it.source}</span>}
                    {it.source && <span className="news-dot">·</span>}
                    <span className="news-time">{relTime(it.datetime)}</span>
                  </div>
                  <div className="news-headline">{it.headline}</div>
                  {it.summary && <div className="news-summary">{it.summary}</div>}
                  <span className="news-cta" aria-hidden="true">
                    Read at source →
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}

        {state === "ready" && (
          <div className="news-foot">Headlines via Finnhub (third-party). Not affiliated with ServiceNow. Not investment advice.</div>
        )}
      </div>
    </section>
  );
}
