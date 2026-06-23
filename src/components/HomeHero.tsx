"use client";

/**
 * Homepage hero — shows just today's delayed price for ServiceNow (NOW). No implied value here;
 * the implied-vs-price comparison lives in the reverse-DCF tool (where the assumptions are).
 *
 * The price comes from the server quote route (Finnhub key stays server-side; falls back to a
 * clearly-flagged placeholder when no live source is configured).
 */

import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/format";
import type { QuotePayload } from "@/app/api/quote/route";

export function HomeHero() {
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote")
      .then((r) => r.json())
      .then((data: QuotePayload) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuoteError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const price = quote?.price ?? null;
  const loading = quote == null && !quoteError;

  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            ServiceNow (NOW) · today&rsquo;s price
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-ink">
            {loading ? "…" : price != null ? formatUsd(price) : "Unavailable"}
          </div>
        </div>
        {quote && (
          <span className="rounded-md bg-stone-soft px-2.5 py-1 text-xs font-medium text-muted">
            {quote.isPlaceholder ? "Placeholder price" : "Delayed"}
          </span>
        )}
      </div>

      {quoteError && price == null && (
        <p className="mt-3 text-sm text-muted">Couldn&rsquo;t load today&rsquo;s price right now.</p>
      )}
    </section>
  );
}
