"use client";

/**
 * Valuation context page body. Fetches live (delayed) prices + computed multiples for NOW and its
 * peers, and renders: NOW's current multiples, a peer table with a Rule-of-40 mini bar, and a
 * growth-vs-multiple scatter (the centerpiece).
 *
 * Framing stays neutral/educational. Teal is the accent; NOW is highlighted in ink.
 */

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import Link from "next/link";
import { formatPercent } from "@/lib/format";
import type { ValuationPayload, CompanyValuation } from "@/app/api/valuation/route";

const fmtX = (v: number) => `${v.toFixed(1)}x`;

export function Valuation() {
  const [data, setData] = useState<ValuationPayload | null>(null);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    fetch("/api/valuation")
      .then((r) => r.json())
      .then((d: ValuationPayload) => {
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
        <p className="text-sm text-muted">Couldn&rsquo;t load valuation data right now.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Loading valuation context…</p>
      </section>
    );
  }

  const now = data.companies.find((c) => c.symbol === "NOW") ?? null;
  const withMult = data.companies.filter((c) => c.multiples != null);

  const point = (c: CompanyValuation) => ({
    symbol: c.symbol,
    growth: Number((c.multiples!.revenueGrowth * 100).toFixed(1)),
    evRev: Number(c.multiples!.evRevenue.toFixed(1)),
  });
  const scatterPeers = withMult.filter((c) => c.symbol !== "NOW").map(point);
  const scatterNow = now?.multiples ? [point(now)] : [];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-5">
        <h3 className="text-base font-semibold text-ink">The numbers</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Company</th>
                <th className="py-2 px-3 text-right font-medium">EV/Rev</th>
                <th className="py-2 px-3 text-right font-medium">Rev growth</th>
                <th className="py-2 px-3 text-right font-medium">FCF margin</th>
                <th className="py-2 pl-3 font-medium">Rule of 40</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <PeerRow key={c.symbol} c={c} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          EV = price × shares − net cash. Prices are live (delayed). For NOW, shares outstanding and
          net cash are pulled live from SEC EDGAR
          {now?.netCashAsOf ? ` (as of ${now.netCashAsOf})` : ""}; peers&rsquo; figures, plus all
          revenue, growth and margin, are approximate public snapshots — refresh from filings.
        </p>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h3 className="text-base font-semibold text-ink">Valuation vs. growth — NOW and peers</h3>
        <p className="text-xs text-muted">
          Each dot is a company: revenue growth (x) against EV/Revenue (y). Faster growers typically
          command higher multiples; NOW is highlighted.
        </p>
        <div className="mt-3 h-72 w-full">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 28, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d8" />
                <XAxis
                  type="number"
                  dataKey="growth"
                  name="growth"
                  unit="%"
                  tick={{ fontSize: 12 }}
                  label={{ value: "Revenue growth (YoY %)", position: "insideBottom", offset: -16, fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="evRev"
                  name="EV/Rev"
                  tick={{ fontSize: 12 }}
                  label={{ value: "EV / revenue (x)", angle: -90, position: "insideLeft", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v, n) => (n === "EV/Rev" ? fmtX(Number(v)) : `${v}%`)}
                />
                <Scatter name="Peers" data={scatterPeers} fill="#0f6e56">
                  <LabelList dataKey="symbol" position="top" style={{ fontSize: 11, fill: "#5f5e5a" }} />
                </Scatter>
                <Scatter name="NOW" data={scatterNow} fill="#1a1a18">
                  <LabelList
                    dataKey="symbol"
                    position="top"
                    style={{ fontSize: 11, fontWeight: 600, fill: "#1a1a18" }}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h3 className="text-base font-semibold text-ink">How to read this</h3>
        <p className="mt-2 text-sm text-muted">
          Multiples are context, not targets. A higher EV/Revenue isn&rsquo;t automatically
          &ldquo;expensive&rdquo; — faster-growing, higher-margin companies tend to trade richer,
          which is why the scatter slopes up. Rule of 40 (growth % + FCF margin %) is a rough
          SaaS-health heuristic: around 40 or above is considered healthy.
        </p>
        <p className="mt-2 text-sm text-muted">
          These multiples are the market&rsquo;s shorthand. The{" "}
          <Link href="/reverse-dcf" className="font-medium text-teal hover:underline">
            Price modeler
          </Link>{" "}
          unpacks what today&rsquo;s price implies in cash-flow terms.
        </p>
      </section>
    </div>
  );
}

function PeerRow({ c }: { c: CompanyValuation }) {
  const m = c.multiples;
  const isNow = c.symbol === "NOW";
  return (
    <tr className={`border-t border-line ${isNow ? "bg-teal-soft" : ""}`}>
      <td className="py-2 pr-3">
        <span className={isNow ? "font-semibold text-ink" : "text-ink"}>{c.name}</span>{" "}
        <span className="text-xs text-muted">{c.symbol}</span>
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-ink">{m ? fmtX(m.evRevenue) : "—"}</td>
      <td className="py-2 px-3 text-right tabular-nums text-ink">
        {m ? formatPercent(m.revenueGrowth) : "—"}
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-ink">
        {m ? formatPercent(m.fcfMargin) : "—"}
      </td>
      <td className="py-2 pl-3">{m ? <Rule40 value={m.ruleOf40} /> : "—"}</td>
    </tr>
  );
}

/** Mini Rule-of-40 bar with a tick at the 40 threshold. */
function Rule40({ value }: { value: number }) {
  const scaleMax = 80;
  const w = Math.max(0, Math.min(100, (value / scaleMax) * 100));
  const fortyPos = (40 / scaleMax) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 rounded-full bg-stone-soft">
        <div className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${w}%` }} />
        <div className="absolute -top-1 -bottom-1 w-px bg-muted" style={{ left: `${fortyPos}%` }} />
      </div>
      <span className="tabular-nums text-ink">{Math.round(value)}</span>
    </div>
  );
}
