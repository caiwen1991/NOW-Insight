"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { runDcf, solveImpliedGrowth, type DcfInputs } from "@/lib/dcf";
import { NOW_COMPANY, DEFAULT_INPUTS, SLIDERS, FUNDAMENTALS_AS_OF } from "@/lib/company";
import { formatPercent, formatUsdBillions } from "@/lib/format";
import { Slider } from "@/components/Slider";
import { GapNumberLine } from "@/components/GapNumberLine";
import type { QuotePayload } from "@/app/api/quote/route";

export function ReverseDcf() {
  const [inputs, setInputs] = useState<DcfInputs>(DEFAULT_INPUTS);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [solveNote, setSolveNote] = useState<string | null>(null);

  // Fetch the live (delayed) price from our server route. The API key stays on the server.
  useEffect(() => {
    setMounted(true);
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

  const result = useMemo(() => runDcf(inputs, NOW_COMPANY), [inputs]);

  const price = quote?.price ?? null;
  const fair = result.fairValuePerShare;
  const valid = Number.isFinite(fair);

  const update = (key: keyof DcfInputs, value: number) => {
    setSolveNote(null);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setSolveNote(null);
    setInputs(DEFAULT_INPUTS);
  };

  const solveForPrice = () => {
    if (price == null) return;
    const g = solveImpliedGrowth(price, inputs, NOW_COMPANY);
    if (g == null) {
      setSolveNote(
        "Couldn't reach today's price within a plausible growth range while holding the other assumptions fixed. Try adjusting margin, WACC, or terminal growth first."
      );
      return;
    }
    setInputs((prev) => ({ ...prev, year1Growth: g }));
    setSolveNote(
      `Holding the other four assumptions fixed, today's price implies a Year-1 revenue growth of about ${formatPercent(
        g
      )}.`
    );
  };

  const chartData = result.perSharesByYear.map((y) => ({
    year: `Y${y.year}`,
    Revenue: Number(y.revenue.toFixed(2)),
    "Free cash flow": Number(y.fcf.toFixed(2)),
  }));

  return (
    <div className="space-y-8">
      <HeroGap valid={valid} fair={fair} quote={quote} quoteError={quoteError} />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Assumptions */}
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your assumptions</h2>
            <button
              onClick={reset}
              className="text-xs font-medium text-teal hover:underline"
            >
              Reset to defaults
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Benchmarks are reference points from public filings or convention — not targets, and not
            advice. Fundamentals as of {FUNDAMENTALS_AS_OF}.
          </p>

          <div className="mt-3">
            {SLIDERS.map((s) => (
              <Slider
                key={s.key}
                label={s.label}
                value={inputs[s.key]}
                min={s.min}
                max={s.max}
                step={s.step}
                benchmark={s.benchmark}
                source={s.source}
                onChange={(v) => update(s.key, v)}
              />
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-stone-soft p-3">
            <button
              onClick={solveForPrice}
              disabled={price == null}
              className="w-full rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              Solve for the growth today&rsquo;s price implies
            </button>
            {solveNote && <p className="mt-2 text-xs text-muted">{solveNote}</p>}
          </div>
        </section>

        {/* Outputs */}
        <section className="space-y-6">
          <ModelOutputs result={result} valid={valid} />

          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="text-base font-semibold text-ink">
              Projected revenue &amp; free cash flow
            </h3>
            <p className="text-xs text-muted">
              Implied 10-year path from your assumptions, in billions of USD. Revenue compounds at a
              growth rate that fades to your terminal rate; FCF margin ramps to your terminal margin.
            </p>
            <div className="mt-3 h-64 w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 24, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d8" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12 }}
                      label={{ value: "Projection year", position: "insideBottom", offset: -14, fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{ value: "$B", angle: -90, position: "insideLeft", fontSize: 12 }}
                    />
                    <Tooltip formatter={(value) => formatUsdBillions(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Revenue" stroke="#0f6e56" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="Free cash flow"
                      stroke="#ba7517"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroGap({
  valid,
  fair,
  quote,
  quoteError,
}: {
  valid: boolean;
  fair: number;
  quote: QuotePayload | null;
  quoteError: boolean;
}) {
  const price = quote?.price ?? null;
  const label = "Your assumptions vs. today's price";

  // Degenerate inputs (e.g. WACC ≤ perpetuity growth) — the model can't produce a finite value.
  if (!valid) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <p className="mt-3 text-sm text-amber-700">
          These assumptions don&rsquo;t produce a finite value — the discount rate must exceed the
          perpetuity growth rate.
        </p>
      </section>
    );
  }

  // Price still loading, or unavailable.
  if (price == null) {
    return (
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <p className="mt-3 text-sm text-muted">
          {quoteError
            ? "Couldn't load a live price right now, but the model below still works."
            : "Loading today's price…"}
        </p>
      </section>
    );
  }

  // The number-line gap hero (same design as the homepage), driven live by the sliders.
  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <GapNumberLine
        price={price}
        fair={fair}
        label={label}
        impliedCaption="Implied (your assumptions)"
      />
    </section>
  );
}

function ModelOutputs({
  result,
  valid,
}: {
  result: ReturnType<typeof runDcf>;
  valid: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">How the value breaks down</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Row label="PV of 10-yr cash flows" value={valid ? formatUsdBillions(result.pvExplicit) : "—"} />
        <Row label="PV of terminal value" value={valid ? formatUsdBillions(result.pvTerminal) : "—"} />
        <Row label="Enterprise value" value={valid ? formatUsdBillions(result.enterpriseValue) : "—"} />
        <Row label="+ Net cash" value={formatUsdBillions(NOW_COMPANY.netCash)} />
        <Row label="Equity value" value={valid ? formatUsdBillions(result.equityValue) : "—"} bold />
        <Row label="÷ Shares (post-split)" value={`${NOW_COMPANY.sharesOutstanding.toFixed(2)}B`} />
      </dl>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right tabular-nums ${bold ? "font-semibold text-ink" : "text-ink"}`}>
        {value}
      </dd>
    </>
  );
}

