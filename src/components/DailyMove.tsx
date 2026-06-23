"use client";

/**
 * Daily move page body. Fetches the server payload (quotes + filings + news + market-open flag),
 * decomposes NOW's move into market / sector-specific / company-specific, and renders the
 * headline, the diverging-bar decomposition, the index readouts, and the "why it moved" panel.
 *
 * Framing stays neutral and educational (no buy/sell language). Teal identifies magnitude; the
 * sign/direction is shown by which side of center a bar sits on, not by green/red.
 */

import { useEffect, useState } from "react";
import { decomposeMove, type MoveDecomposition } from "@/lib/dailyMove";
import { formatPercent, formatUsd } from "@/lib/format";
import type { DailyMovePayload, SymbolQuote } from "@/app/api/daily-move/route";

const ITEM_LABELS: Record<string, string> = {
  "1.01": "Entry into a material agreement",
  "1.02": "Termination of a material agreement",
  "2.02": "Results of operations & financial condition",
  "2.03": "Creation of a financial obligation",
  "3.02": "Unregistered sale of equity",
  "5.02": "Officer / director change",
  "5.07": "Shareholder vote results",
  "7.01": "Regulation FD disclosure",
  "8.01": "Other events",
  "9.01": "Financial statements & exhibits",
};

const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${formatPercent(Math.abs(v))}`;

export function DailyMove() {
  const [data, setData] = useState<DailyMovePayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-move")
      .then((r) => r.json())
      .then((d: DailyMovePayload) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Couldn&rsquo;t load today&rsquo;s data right now.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Loading today&rsquo;s move…</p>
      </section>
    );
  }

  const { now, market, sector } = data.quotes;
  const haveMoves =
    now.changePercent != null && market.changePercent != null && sector.changePercent != null;
  const decomp = haveMoves
    ? decomposeMove({
        nowPct: now.changePercent!,
        marketPct: market.changePercent!,
        sectorPct: sector.changePercent!,
      })
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs uppercase tracking-wide text-muted">Today&rsquo;s move, decomposed</span>
          <StatusBadge marketOpen={data.marketOpen} />
        </div>

        {decomp ? (
          <>
            <p className="mt-3 text-lg font-medium text-ink">{headline(decomp)}</p>
            <div className="mt-6">
              <DivergingBars decomp={decomp} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Live index data is unavailable right now, so today&rsquo;s decomposition can&rsquo;t be
            computed. {data.notes.join(" ")}
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <IndexCard label="ServiceNow" sub="NOW" quote={now} />
        <IndexCard label="Broad market" sub="SPY" quote={market} />
        <IndexCard label="Software sector" sub="IGV" quote={sector} />
      </div>

      <WhyItMoved data={data} />

      <section className="rounded-xl border border-line bg-white p-5">
        <h3 className="text-base font-semibold text-ink">How to read this</h3>
        <p className="mt-2 text-sm text-muted">
          When the company-specific slice is small, the day&rsquo;s move was mostly macro — the broad
          market or the whole software sector moving together, not something specific to ServiceNow.
          A large company-specific slice is the signal to look for real, identifiable NOW news.
        </p>
      </section>
    </div>
  );
}

function headline(d: MoveDecomposition): string {
  const dir = d.total >= 0 ? "up" : "down";
  const totalAbs = formatPercent(Math.abs(d.total));
  const companyAbs = formatPercent(Math.abs(d.companySpecific));
  switch (d.classification) {
    case "flat":
      return `NOW is roughly flat today (${signedPct(d.total)}).`;
    case "mostly-macro":
      return `NOW is ${dir} ${totalAbs} today — most of that is the broad market and software sector moving together. Only about ${companyAbs} is specific to ServiceNow.`;
    case "mixed":
      return `NOW is ${dir} ${totalAbs} today — partly the market and software sector, and about ${companyAbs} specific to ServiceNow.`;
    case "mostly-company":
      return `NOW is ${dir} ${totalAbs} today — about ${companyAbs} of that is specific to ServiceNow, more than the broad market or software sector explain.`;
  }
}

function DivergingBars({ decomp }: { decomp: MoveDecomposition }) {
  const rows = [
    { label: "Market", sub: "SPY", value: decomp.market, total: false },
    { label: "Sector-specific", sub: "IGV − SPY", value: decomp.sectorSpecific, total: false },
    { label: "Company-specific", sub: "NOW − IGV", value: decomp.companySpecific, total: false },
  ];
  const maxAbs = Math.max(
    Math.abs(decomp.market),
    Math.abs(decomp.sectorSpecific),
    Math.abs(decomp.companySpecific),
    Math.abs(decomp.total),
    0.0001
  );

  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wide text-muted">
        <span>← down</span>
        <span>up →</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <BarRow key={r.label} {...r} maxAbs={maxAbs} />
        ))}
        <div className="border-t border-line pt-2">
          <BarRow label="NOW total" sub="" value={decomp.total} total maxAbs={maxAbs} />
        </div>
      </div>
    </div>
  );
}

function BarRow({
  label,
  sub,
  value,
  total,
  maxAbs,
}: {
  label: string;
  sub: string;
  value: number;
  total: boolean;
  maxAbs: number;
}) {
  const w = (Math.abs(value) / maxAbs) * 44;
  const left = value >= 0 ? 50 : 50 - w;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <div className={`text-sm ${total ? "font-semibold text-ink" : "text-ink"}`}>{label}</div>
        {sub && <div className="text-[11px] text-muted">{sub}</div>}
      </div>
      <div className="relative h-6 flex-1">
        <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        <div
          className={`absolute inset-y-1 rounded ${total ? "bg-ink" : "bg-teal"}`}
          style={{ left: `${left}%`, width: `${w}%` }}
        />
      </div>
      <div
        className={`w-16 shrink-0 text-right text-sm tabular-nums ${
          total ? "font-semibold text-ink" : "text-ink"
        }`}
      >
        {signedPct(value)}
      </div>
    </div>
  );
}

function IndexCard({ label, sub, quote }: { label: string; sub: string; quote: SymbolQuote }) {
  return (
    <div className="rounded-md bg-stone-soft p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{sub}</span>
      </div>
      <div className="mt-1 text-2xl font-medium tabular-nums text-ink">
        {quote.changePercent != null ? signedPct(quote.changePercent) : "—"}
      </div>
      <div className="text-xs text-muted">
        {quote.price != null ? formatUsd(quote.price) : "price unavailable"}
        {quote.isPlaceholder ? " · placeholder" : ""}
      </div>
    </div>
  );
}

function WhyItMoved({ data }: { data: DailyMovePayload }) {
  const { filings, news } = data;
  const nothing = filings.length === 0 && news.length === 0;

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">Why it moved</h3>

      {nothing && (
        <p className="mt-2 text-sm text-muted">
          No ServiceNow SEC filings or press identified in the last few days — today&rsquo;s move
          looks broad-based rather than driven by specific company news.
        </p>
      )}

      {filings.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            SEC filings (official)
          </div>
          <ul className="mt-2 space-y-2">
            {filings.map((f, i) => (
              <li key={i} className="text-sm">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal hover:underline"
                >
                  {f.form}
                </a>{" "}
                <span className="text-muted">· {f.filedAt}</span>
                {f.items.length > 0 && (
                  <div className="text-xs text-muted">
                    {f.items.map((it) => ITEM_LABELS[it] ?? `Item ${it}`).join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {news.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Recent press (third-party)
          </div>
          <ul className="mt-2 space-y-2">
            {news.map((n, i) => (
              <li key={i} className="text-sm">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:underline"
                >
                  {n.headline}
                </a>
                <div className="text-xs text-muted">
                  {n.source} · {shortDate(n.datetime)}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Press headlines are third-party and may include speculation — they are context, not
            confirmation. Official events come from SEC filings above.
          </p>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ marketOpen }: { marketOpen: boolean }) {
  return (
    <span className="shrink-0 rounded-md bg-stone-soft px-2.5 py-1 text-xs font-medium text-muted">
      {marketOpen ? "Provisional · updates until close" : "Final · last close"}
    </span>
  );
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
