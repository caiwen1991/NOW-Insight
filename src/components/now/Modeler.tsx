"use client";

/**
 * Interactive 5-year modeler. Deliberately simple (the design's stated method, NOT a DCF):
 * grow live TTM revenue at the chosen rate, apply a cash-flow margin, put a P/FCF multiple on that
 * cash flow, divide by live shares → a price. Bull/base/bear flank the base case. Seeded from the
 * live reported growth/margin (EDGAR) and the live revenue base + share count.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useOverview } from "./OverviewProvider";
import { usd0, signedPct } from "./format";

const HORIZON = 5;

interface Inputs {
  g: number; // revenue growth %/yr
  m: number; // FCF margin %
  k: number; // P/FCF multiple
}

const DEFAULTS: Inputs = { g: 18, m: 33, k: 24 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Modeled price `t` years out for a given growth/margin/multiple, in $/share. */
function priceAt(t: number, inp: Inputs, startRevB: number, sharesB: number): number {
  const rev = startRevB * Math.pow(1 + inp.g / 100, t);
  const fcf = rev * (inp.m / 100);
  const equity = fcf * inp.k; // $B
  return (equity / sharesB) || 0; // $/share
}

export function Modeler() {
  const { data } = useOverview();
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const [preset, setPreset] = useState<string | null>(null);
  const seeded = useRef(false);

  const startRev = data?.revenueTtm ?? 14.0;
  const shares = data?.shares ?? 1.03;
  const price = data?.price ?? null;
  const reportedG = data?.revenueGrowthYoY ?? null;
  const reportedM = data?.fcfMargin ?? null;

  // Seed base growth/margin from the live reported figures once, if the user hasn't touched anything.
  useEffect(() => {
    if (seeded.current || !data) return;
    seeded.current = true;
    setInp((prev) => ({
      ...prev,
      g: reportedG != null ? clamp(Math.round(reportedG * 100), 5, 30) : prev.g,
      m: reportedM != null ? clamp(Math.round(reportedM * 100), 20, 45) : prev.m,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const set = (key: keyof Inputs, value: number) => {
    setPreset(null);
    setInp((prev) => ({ ...prev, [key]: value }));
  };

  const presets = useMemo(() => {
    const rg = reportedG != null ? clamp(Math.round(reportedG * 100), 5, 30) : 18;
    const rm = reportedM != null ? clamp(Math.round(reportedM * 100), 20, 45) : 33;
    return {
      conservative: { g: clamp(rg - 8, 5, 30), m: clamp(rm - 5, 20, 45), k: 16 },
      consensus: { g: rg, m: rm, k: 24 },
      ambitious: { g: clamp(rg + 7, 5, 30), m: clamp(rm + 5, 20, 45), k: 32 },
    } as Record<string, Inputs>;
  }, [reportedG, reportedM]);

  const applyPreset = (name: string) => {
    setInp(presets[name]);
    setPreset(name);
  };

  const horizonYear = new Date().getFullYear() + HORIZON;

  const base = priceAt(HORIZON, inp, startRev, shares);
  const ret = (p: number) => (price ? p / price - 1 : null);

  // Projection bars: live current price (sage) then the modeled price path.
  const pathPrices = [price ?? base, ...Array.from({ length: HORIZON }, (_, i) => priceAt(i + 1, inp, startRev, shares))];
  const maxBar = Math.max(...pathPrices);
  const startYear = horizonYear - HORIZON;

  // Headline stats vs. today's live price.
  const upside = ret(base); // total return over the horizon (decimal), or null if no live price
  const cagr = price ? Math.pow(base / price, 1 / HORIZON) - 1 : null; // implied annualized return
  const assume = (i: Inputs) => `${i.g}% growth · ${i.m}% FCF · ${i.k}×`;

  return (
    <section className="block" id="model">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Pull the levers</div>
          <h2>Model the stock&rsquo;s potential</h2>
          <p className="lede">
            Pick your assumptions for the next five years. We grow revenue, apply a cash-flow margin,
            put a multiple on that cash flow, and divide by shares to get a price. Watch the modeled
            price and its path update as you move the levers.
          </p>
        </div>

        <div className="modeler">
          <div className="modeler-grid">
            {/* Controls */}
            <div className="controls">
              <h3>Your assumptions</h3>
              <div className="sub">
                {HORIZON}-year horizon · starting from {`$${startRev.toFixed(1)}B`} revenue
              </div>

              <div className="preset-row">
                {(["conservative", "consensus", "ambitious"] as const).map((name) => (
                  <button
                    key={name}
                    className={`preset${preset === name ? " on" : ""}`}
                    onClick={() => applyPreset(name)}
                  >
                    {name[0].toUpperCase() + name.slice(1)}
                  </button>
                ))}
              </div>

              <div className="control">
                <div className="lab">
                  <span className="name">Revenue growth /yr</span>
                  <span className="val">{inp.g}%</span>
                </div>
                <input type="range" min={5} max={30} step={1} value={inp.g} onChange={(e) => set("g", +e.target.value)} />
                <div className="hint">
                  {reportedG != null
                    ? `Reported: ${signedPct(reportedG, 0)} over the last year (EDGAR).`
                    : "Reported growth from SEC EDGAR filings."}
                </div>
              </div>

              <div className="control">
                <div className="lab">
                  <span className="name">Free-cash-flow margin</span>
                  <span className="val">{inp.m}%</span>
                </div>
                <input type="range" min={20} max={45} step={1} value={inp.m} onChange={(e) => set("m", +e.target.value)} />
                <div className="hint">
                  {reportedM != null
                    ? `Reported: most recent FCF margin ~${Math.round(reportedM * 100)}% (EDGAR).`
                    : "Reported FCF margin from SEC EDGAR filings."}
                </div>
              </div>

              <div className="control">
                <div className="lab">
                  <span className="name">Valuation multiple (P/FCF)</span>
                  <span className="val">{inp.k}×</span>
                </div>
                <input type="range" min={10} max={45} step={1} value={inp.k} onChange={(e) => set("k", +e.target.value)} />
                <div className="hint">What the market pays per $1 of future cash flow.</div>
              </div>
            </div>

            {/* Results */}
            <div className="results">
              <div className="model-summary">
                <div className="model-headline">
                  <div className="k">Modeled price in {horizonYear}</div>
                  <div className="bigprice">
                    <span className="cur">$</span>
                    {Math.round(base).toLocaleString("en-US")}
                  </div>
                </div>
                <div className="model-stats">
                  <div className="stat-row">
                    <div className="stat-card">
                      <div className="sk">Upside vs today</div>
                      <div
                        className="sv"
                        style={{ color: upside != null && upside < 0 ? "var(--neg)" : "var(--pos)" }}
                      >
                        {upside != null ? signedPct(upside, 0) : "—"}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="sk">Implied return</div>
                      <div
                        className="sv"
                        style={{ color: cagr != null && cagr < 0 ? "var(--neg)" : "var(--pos)" }}
                      >
                        {cagr != null ? `${signedPct(cagr, 0)}/yr` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="sk">Your assumptions</div>
                    <div className="sv-assume">{assume(inp)}</div>
                  </div>
                </div>
              </div>

              <div className="proj-chart">
                <div className="cap">
                  <span>Modeled price path</span>
                  <span>Now → {horizonYear}</span>
                </div>
                <div className="barscol">
                  {pathPrices.map((v, i) => (
                    <div className="col" key={i}>
                      <div className="bv">{usd0(v)}</div>
                      <div
                        className={`bx${i === 0 ? " now" : ""}`}
                        style={{ height: `${maxBar > 0 ? (v / maxBar) * 100 : 0}%` }}
                      />
                      <div className="yr">{i === 0 ? "Now" : `'${String(startYear + i).slice(2)}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="assumption-note" style={{ maxWidth: "none" }}>
          Today: <strong>{price != null ? usd0(price) : "—"}</strong> ·{" "}
          <span>~{shares.toFixed(2)}B</span> shares. The math is deliberately simple so the{" "}
          <em>levers</em> are clear — it is not a discounted-cash-flow valuation.
        </p>
      </div>
    </section>
  );
}
