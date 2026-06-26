"use client";

/**
 * Reverse-DCF modeler. Forward: project 10 years of revenue → free cash flow, discount at WACC, add
 * a Gordon-growth terminal value and net cash, divide by shares → implied fair value. Reverse: hold
 * today's live price fixed and solve for the year-1 growth the market is implying. All company facts
 * (revenue, current FCF margin, net cash, shares) come live from /api/overview (EDGAR + Finnhub).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useOverview } from "./OverviewProvider";
import { runDcf, type DcfInputs, type DcfCompany } from "@/lib/dcf";
import { NOW_COMPANY, DEFAULT_INPUTS, SLIDERS } from "@/lib/company";
import { usd0, usdB, pct, signedPct } from "./format";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Display labels for the three scenario presets (internal keys stay conservative/consensus/ambitious). */
const PRESET_LABELS: Record<string, string> = {
  conservative: "Bear",
  consensus: "Management",
  ambitious: "Bull",
};

/**
 * Plain-English narrative shown under the buttons when a scenario is selected. The Management case is
 * anchored to ServiceNow's FY2026 guidance from its Q1 2026 investor presentation (Apr 22, 2026):
 * subscription revenue ~+22%, non-GAAP operating margin 31.5%, non-GAAP FCF margin 35%.
 */
const PRESET_NARRATIVES: Record<string, string> = {
  conservative:
    "Bear case: growth decelerates well below guidance toward the low-teens and free-cash-flow margins slip to ~30%, as AI pressures seat-based pricing and the platform matures faster than management expects.",
  consensus:
    "Anchored to ServiceNow's FY2026 guidance (Q1'26 deck, Apr 2026): ~22% subscription-revenue growth, a 31.5% operating margin and a 35% non-GAAP FCF margin (Q1'26 ran 32% / 44%). Here growth starts near that pace and fades to a 3% long-run rate while margins hold in the low-30s.",
  ambitious:
    "Bull case: AI (Now Assist) keeps growth in the high-20s and FCF margins expand past management's ~35% target toward ~38%, with demand durable enough to support a higher long-run growth rate.",
};

export function Modeler() {
  const { data } = useOverview();
  const [inputs, setInputs] = useState<DcfInputs>(DEFAULT_INPUTS);
  const [preset, setPreset] = useState<string | null>("consensus");
  const seeded = useRef(false);

  const price = data?.price ?? null;
  const reportedG = data?.revenueGrowthYoY ?? null;
  const reportedM = data?.fcfMargin ?? null;

  // Company facts for the engine — live, with vetted fallbacks.
  const company: DcfCompany = useMemo(
    () => ({
      ttmRevenue: data?.revenueTtm ?? NOW_COMPANY.ttmRevenue,
      currentFcfMargin: data?.fcfMargin ?? NOW_COMPANY.currentFcfMargin,
      netCash: data?.netCash ?? NOW_COMPANY.netCash,
      sharesOutstanding: data?.shares ?? NOW_COMPANY.sharesOutstanding,
    }),
    [data]
  );

  const set = (key: keyof DcfInputs, value: number) => {
    setPreset(null);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const presets = useMemo<Record<string, DcfInputs>>(() => {
    const g = reportedG != null ? clamp(reportedG, -0.1, 0.6) : DEFAULT_INPUTS.year1Growth;
    const m = reportedM != null ? clamp(reportedM, 0.1, 0.5) : DEFAULT_INPUTS.terminalFcfMargin;
    return {
      conservative: { year1Growth: clamp(g - 0.09, -0.1, 0.6), terminalGrowth: 0.025, terminalFcfMargin: clamp(m - 0.03, 0.1, 0.5), wacc: 0.09, perpetuityGrowth: 0.025 },
      consensus: { year1Growth: g, terminalGrowth: 0.03, terminalFcfMargin: 0.33, wacc: 0.09, perpetuityGrowth: 0.025 },
      ambitious: { year1Growth: clamp(g + 0.06, -0.1, 0.6), terminalGrowth: 0.04, terminalFcfMargin: clamp(m + 0.05, 0.1, 0.5), wacc: 0.09, perpetuityGrowth: 0.025 },
    };
  }, [reportedG, reportedM]);

  // On first data load, apply the live-seeded Consensus scenario (the default selection).
  useEffect(() => {
    if (seeded.current || !data) return;
    seeded.current = true;
    setInputs(presets.consensus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const applyPreset = (name: string) => {
    setInputs(presets[name]);
    setPreset(name);
  };

  const result = useMemo(() => runDcf(inputs, company), [inputs, company]);
  const fair = result.fairValuePerShare;
  const valid = Number.isFinite(fair);
  const gap = price != null && valid ? fair / price - 1 : null;

  // Tint the fair-value card: light green when implied value > price, light red when below.
  const headlineBg =
    gap == null
      ? "var(--surface)"
      : gap >= 0
        ? "color-mix(in srgb, var(--pos) 9%, var(--surface))"
        : "color-mix(in srgb, var(--neg) 9%, var(--surface))";
  const headlineBorder =
    gap == null
      ? "var(--line)"
      : gap >= 0
        ? "color-mix(in srgb, var(--pos) 22%, var(--line))"
        : "color-mix(in srgb, var(--neg) 22%, var(--line))";

  const hintFor = (key: keyof DcfInputs, fallback: string) => {
    if (key === "year1Growth" && reportedG != null)
      return `Reported: ~${pct(reportedG, 0)} YoY (EDGAR). Fades to your terminal rate by year 10.`;
    if (key === "terminalFcfMargin" && reportedM != null)
      return `Today ~${pct(reportedM, 0)} (EDGAR); ramps to this by year 10.`;
    return fallback;
  };

  const assumeText = `${pct(inputs.year1Growth, 0)}→${pct(inputs.terminalGrowth, 0)} growth · ${pct(
    inputs.terminalFcfMargin,
    0
  )} margin · ${pct(inputs.wacc, 0)} WACC`;

  const fcfYears = result.perSharesByYear;
  const maxFcf = Math.max(...fcfYears.map((y) => y.fcf), 1);
  const baseYear = new Date().getFullYear();

  return (
    <section className="block" id="model">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Pull the levers</div>
          <h2>Model the Fair Price</h2>
          <p className="lede">
            Set your assumptions, and see the implied value under a simplified Discounted Cash Flow
            (DCF) valuation.
          </p>
        </div>

        <div className="modeler">
          <div className="modeler-grid">
            {/* Controls */}
            <div className="controls">
              <h3>Your assumptions</h3>
              <div className="sub">
                10-year horizon · starting from {`$${company.ttmRevenue.toFixed(1)}B`} revenue
              </div>

              <div className="preset-row">
                {(["conservative", "consensus", "ambitious"] as const).map((name) => (
                  <button
                    key={name}
                    className={`preset${preset === name ? " on" : ""}`}
                    onClick={() => applyPreset(name)}
                  >
                    {PRESET_LABELS[name]}
                  </button>
                ))}
              </div>

              {preset && PRESET_NARRATIVES[preset] && (
                <p className="preset-note">{PRESET_NARRATIVES[preset]}</p>
              )}

              {SLIDERS.map((s) => (
                <div className="control" key={s.key}>
                  <div className="lab">
                    <span className="name">{s.label}</span>
                    <span className="val">{pct(inputs[s.key], 1)}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={inputs[s.key]}
                    onChange={(e) => set(s.key, +e.target.value)}
                  />
                  <div className="hint">{hintFor(s.key, s.benchmark)}</div>
                </div>
              ))}
            </div>

            {/* Results */}
            <div className="results">
              <div className="model-summary">
                <div
                  className="model-headline headline-card"
                  style={{ background: headlineBg, borderColor: headlineBorder }}
                >
                  <div className="k">Implied fair value</div>
                  <div className="bigprice">
                    <span className="cur">$</span>
                    {valid ? Math.round(fair).toLocaleString("en-US") : "—"}
                  </div>
                  <div className="assume" style={{ marginTop: 8 }}>
                    per share · today {price != null ? usd0(price) : "—"}
                  </div>
                </div>
                <div className="model-stats">
                  <div className="stat-row">
                    <div className="stat-card">
                      <div className="sk">Implied value vs today</div>
                      <div
                        className="sv"
                        style={{ color: gap != null && gap < 0 ? "var(--neg)" : "var(--pos)" }}
                      >
                        {gap != null ? signedPct(gap, 0) : "—"}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="sk">Implied enterprise value</div>
                      <div className="sv" style={{ color: "var(--ink)" }}>
                        {valid ? usdB(result.enterpriseValue, 0) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="sk">Your assumptions</div>
                    <div className="sv-assume">{assumeText}</div>
                  </div>
                </div>
              </div>

              <div className="proj-chart">
                <div className="cap">
                  <span>Projected free cash flow ($B)</span>
                  <span>Year 1 → 10</span>
                </div>
                <div className="barscol">
                  {fcfYears.map((y, i) => (
                    <div className="col" key={y.year}>
                      <div className="bv">{y.fcf.toFixed(0)}</div>
                      <div className="bx" style={{ height: `${(y.fcf / maxFcf) * 100}%` }} />
                      <div className="yr">{`'${String(baseYear + i + 1).slice(2)}`}</div>
                    </div>
                  ))}
                </div>
              </div>

              {valid ? (
                <p className="assumption-note" style={{ maxWidth: "none" }}>
                  {usdB(result.pvExplicit, 0)} PV of 10-yr cash flows + {usdB(result.pvTerminal, 0)} PV
                  of terminal value = {usdB(result.enterpriseValue, 0)} enterprise value, +{" "}
                  {usdB(company.netCash, 1)} net cash = {usdB(result.equityValue, 0)} equity ÷{" "}
                  {company.sharesOutstanding.toFixed(2)}B shares = ${fair.toFixed(0)}/share.
                </p>
              ) : (
                <p className="assumption-note" style={{ maxWidth: "none" }}>
                  These assumptions don&rsquo;t produce a finite value — the discount rate (WACC) must
                  exceed the perpetuity growth rate.
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="assumption-note" style={{ maxWidth: "none" }}>
          Today: <strong>{price != null ? usd0(price) : "—"}</strong> ·{" "}
          <span>~{company.sharesOutstanding.toFixed(2)}B</span> shares. A simplified 10-year DCF —
          growth fades to your terminal rate, FCF margin ramps to target, cash flows are discounted at
          your WACC, and a Gordon-growth perpetuity captures value beyond year 10. The discount rate
          is the annual return an investor requires. Educational — not a forecast or a recommendation.
        </p>
      </div>
    </section>
  );
}
