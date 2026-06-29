"use client";

/**
 * Reverse-DCF modeler. Forward: project 10 years of revenue → free cash flow, discount at WACC, add
 * a Gordon-growth terminal value and net cash, divide by shares → implied fair value. Reverse: hold
 * today's live price fixed and solve for the year-1 growth the market is implying. All company facts
 * (revenue, current FCF margin, net cash, shares) come live from /api/overview (EDGAR + Finnhub).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useOverview } from "./OverviewProvider";
import { runDcf, type DcfInputs, type DcfCompany } from "@/lib/dcf";
import { NOW_COMPANY, DEFAULT_INPUTS, SLIDERS } from "@/lib/company";
import { usd0, usdB, pct, signedPct } from "./format";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Display labels for the three scenario presets (internal keys stay conservative/consensus/ambitious). */
const PRESET_LABELS: Record<string, string> = {
  conservative: "Bear",
  consensus: "Base",
  ambitious: "Bull",
};

/** Plain-English narrative shown under the buttons when a scenario is selected — summarizes its assumptions. */
const PRESET_NARRATIVES: Record<string, string> = {
  conservative:
    "Bear case: near-term growth slows to ~16% and fades to 2% by year 10, the FCF margin holds at ~30%, and a higher 10% discount rate prices in more risk, reflecting AI pressure on seat-based pricing and a platform that matures faster than expected.",
  consensus:
    "Base case: ~21% near-term growth (in line with the latest reported full year) fading to a 3% long-run rate, a steady ~33% FCF margin, a 9% discount rate and 2.5% perpetuity growth; a middle-of-the-road path roughly consistent with recent results.",
  ambitious:
    "Bull case: AI (Now Assist) keeps growth near 24% before fading to a durable 5%, the FCF margin expands to ~38% (past management's ~35% target), and a lower 8% discount rate reflects high confidence in the platform.",
};

/**
 * Small pixel-measured line chart for one assumed series across the 10-year horizon. Measures its own
 * width (ResizeObserver) so the line fills the column and the axis/value labels render crisp (no
 * aspect-ratio distortion). Each point is dotted and labeled with its value; years run along the base.
 */
function MiniSeriesChart({
  label,
  years,
  values,
  format,
}: {
  label: string;
  years: string[];
  values: number[];
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setW(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 128;
  const padT = 16;
  const padB = 22;
  const padX = 18;
  const n = values.length;
  const max = Math.max(...values);
  // Zero-anchored y-axis: a nearly-flat series (e.g. a steady margin) must read as flat, not as a
  // dramatic slope from a truncated axis. Headroom at the top leaves room for the value labels.
  const lo = 0;
  const hi = max * 1.18 || 1;
  const span = hi - lo || 1;
  const gid = `mc-${label.replace(/\s+/g, "")}`;

  const x = (i: number) => (n <= 1 ? w / 2 : padX + (i / (n - 1)) * (w - 2 * padX));
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const d = w > 0 ? values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") : "";
  const area = w > 0 ? `${d} L${x(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z` : "";

  return (
    <div className="mini-chart">
      <div className="mini-cap">{label}</div>
      <div ref={ref} className="mini-plot">
        {w > 0 && (
          <svg width={w} height={H} aria-label={`${label} by year`} style={{ display: "block" }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={0} x2={w} y1={H - padB} y2={H - padB} stroke="var(--line)" />
            <path d={area} fill={`url(#${gid})`} stroke="none" />
            <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(v)} r={2.6} fill="var(--accent)" />
                <text x={x(i)} y={y(v) - 7} textAnchor="middle" fontSize={9} fill="var(--ink-soft)" fontFamily="var(--font-plex), monospace">
                  {format(v)}
                </text>
                <text x={x(i)} y={H - 7} textAnchor="middle" fontSize={9.5} fill="var(--ink-faint)">
                  {years[i]}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * Terminal-value share — the "honesty" graphic. A stacked bar splitting enterprise value into the PV
 * of the explicit 10-year cash flows vs. the PV of the terminal (perpetuity) value. The point it
 * teaches: most of a DCF's "fair value" usually lives beyond year 10, so the WACC/perpetuity
 * assumptions matter more than the year-1 growth slider people instinctively drag.
 */
function TerminalShareBar({ pvExplicit, pvTerminal }: { pvExplicit: number; pvTerminal: number }) {
  const ev = pvExplicit + pvTerminal;
  const termPct = ev > 0 ? pvTerminal / ev : 0;
  const expPct = 1 - termPct;
  return (
    <div className="tvshare">
      <div className="mini-cap">Where today&rsquo;s value comes from</div>
      <div className="tv-bar">
        {/* Fixed precision: raw floats serialize differently server vs client → hydration mismatch. */}
        <div className="tv-seg tv-exp" style={{ width: `${(expPct * 100).toFixed(2)}%` }} />
        <div className="tv-seg tv-term" style={{ width: `${(termPct * 100).toFixed(2)}%` }} />
      </div>
      <div className="tv-legend">
        <span>
          <i className="tv-dot tv-exp" /> 10-yr cash flows · {usdB(pvExplicit, 0)} ({pct(expPct, 0)})
        </span>
        <span>
          <i className="tv-dot tv-term" /> Terminal value · {usdB(pvTerminal, 0)} ({pct(termPct, 0)})
        </span>
      </div>
      <p className="tv-note">
        <strong>{pct(termPct, 0)}</strong> of the implied value sits beyond year 10, in the terminal
        (perpetuity) assumption, which is why the WACC and perpetuity sliders move the answer more than
        year-1 growth.
      </p>
    </div>
  );
}

/**
 * 2D sensitivity heatmap — fair value across WACC (columns) × FCF margin (rows), a 5×5 grid centered
 * on the current assumptions. Cells are shaded vs. today's price (green above / red below) and the
 * center cell (= current assumptions) is ringed. The lesson: see how fragile the single number is.
 */
function SensitivityHeatmap({
  inputs,
  company,
  price,
}: {
  inputs: DcfInputs;
  company: DcfCompany;
  price: number;
}) {
  const minWacc = inputs.perpetuityGrowth + 0.006; // keep WACC > perpetuity so the DCF stays finite
  const waccCols = [-2, -1, 0, 1, 2].map((k) => Math.max(minWacc, +(inputs.wacc + k * 0.01).toFixed(4)));
  const marginRows = [2, 1, 0, -1, -2].map((k) => clamp(+(inputs.terminalFcfMargin + k * 0.03).toFixed(4), 0.05, 0.6));

  const fairAt = (w: number, m: number) =>
    runDcf({ ...inputs, wacc: w, terminalFcfMargin: m }, company).fairValuePerShare;

  return (
    <div className="heatmap">
      <div className="mini-cap">Fair value ($/share) · WACC × FCF margin</div>
      <div className="hm-grid" style={{ gridTemplateColumns: `auto repeat(${waccCols.length}, var(--hm-cell))` }}>
        <div className="hm-corner">
          margin&nbsp;↓<br />WACC&nbsp;→
        </div>
        {waccCols.map((w, i) => (
          <div key={`c${i}`} className="hm-colh">
            {pct(w, 0)}
          </div>
        ))}
        {marginRows.map((m, ri) => (
          <Fragment key={`r${ri}`}>
            <div className="hm-rowh">{pct(m, 0)}</div>
            {waccCols.map((w, ci) => {
              const v = fairAt(w, m);
              const valid = Number.isFinite(v);
              const g = valid ? v / price - 1 : 0;
              const t = Math.max(-1, Math.min(1, g / 0.6));
              const bg = !valid
                ? "var(--surface)"
                : t >= 0
                  ? `color-mix(in srgb, var(--pos) ${Math.round(t * 44)}%, var(--surface))`
                  : `color-mix(in srgb, var(--neg) ${Math.round(-t * 44)}%, var(--surface))`;
              const current = ci === 2 && ri === 2;
              return (
                <div
                  key={`c${ci}`}
                  className={`hm-cell${current ? " current" : ""}`}
                  style={{ background: bg }}
                  title={`WACC ${pct(w, 1)} · FCF margin ${pct(m, 1)} → ${valid ? usd0(v) : "–"}`}
                >
                  {valid ? Math.round(v) : "–"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="hm-foot">
        Shaded vs today&rsquo;s {usd0(price)}: green above, red below; ringed = your current
        assumptions.
      </div>
    </div>
  );
}

export function Modeler() {
  const { data } = useOverview();
  const [inputs, setInputs] = useState<DcfInputs>(DEFAULT_INPUTS);
  const [preset, setPreset] = useState<string | null>("consensus");
  const [controlsOpen, setControlsOpen] = useState(true);
  const seeded = useRef(false);

  const price = data?.price ?? null;
  const reportedG = data?.revenueGrowthYoY ?? null;
  const reportedM = data?.fcfMargin ?? null;
  const capmWacc = data?.capmWacc ?? null;

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
    // Year-1 growth and FCF margin link to LIVE EDGAR; WACC links to the LIVE CAPM estimate
    // (Base = derived value, Bear/Bull ±1pp for risk appetite). Terminal growth and perpetuity stay
    // FIXED per scenario (forward conventions, not derivable from filings).
    const g = reportedG != null ? clamp(reportedG, -0.1, 0.6) : DEFAULT_INPUTS.year1Growth;
    const m = reportedM != null ? clamp(reportedM, 0.1, 0.5) : DEFAULT_INPUTS.terminalFcfMargin;
    const w = capmWacc != null ? clamp(capmWacc, 0.04, 0.15) : DEFAULT_INPUTS.wacc;
    return {
      conservative: { year1Growth: clamp(g - 0.05, -0.1, 0.6), terminalGrowth: 0.02, terminalFcfMargin: clamp(m - 0.03, 0.1, 0.5), wacc: clamp(w + 0.01, 0.04, 0.15), perpetuityGrowth: 0.02 },
      consensus: { year1Growth: g, terminalGrowth: 0.03, terminalFcfMargin: m, wacc: w, perpetuityGrowth: 0.025 },
      ambitious: { year1Growth: clamp(g + 0.03, -0.1, 0.6), terminalGrowth: 0.05, terminalFcfMargin: clamp(m + 0.05, 0.1, 0.5), wacc: clamp(w - 0.01, 0.04, 0.15), perpetuityGrowth: 0.03 },
    };
  }, [reportedG, reportedM, capmWacc]);

  // On first data load, apply the live-seeded Base scenario (the default selection).
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
      return `~${pct(reportedG, 0)} FY25 vs. FY24 growth, from latest annual report`;
    if (key === "terminalFcfMargin" && reportedM != null)
      return `~${pct(reportedM, 0)} from latest public filing`;
    if (key === "wacc" && data?.beta != null)
      return `CAPM: ${pct(data.riskFreeRate, 1)} risk-free + ${data.beta.toFixed(2)} beta × ${pct(data.equityRiskPremium, 1)} equity risk premium ≈ ${pct(data.capmWacc, 1)}`;
    return fallback;
  };

  const assumeText = `${pct(inputs.year1Growth, 0)}→${pct(inputs.terminalGrowth, 0)} growth · ${pct(
    inputs.terminalFcfMargin,
    0
  )} margin · ${pct(inputs.wacc, 0)} WACC`;

  // Which scenario is active — a preset (Bear/Base/Bull), or "Custom" once a slider is moved.
  const caseLabel = preset ? PRESET_LABELS[preset] : "Custom";

  const projYears = result.perSharesByYear;
  const baseYear = new Date().getFullYear();
  const projLabels = projYears.map((_, i) => `'${String(baseYear + i + 1).slice(2)}`);
  const growthSeries = projYears.map((y) => y.growth);
  const fmtPct1 = (v: number) => pct(v, 1);

  return (
    <section className="block" id="model">
      <div className="wrap">
        <div className="section-head">
          <h2>Model the fair price</h2>
          <p className="lede">
            Set your assumptions, and see the implied value under a simplified Discounted Cash Flow
            (DCF) valuation.
          </p>
        </div>

        <div className="modeler">
          <div className={`modeler-grid${controlsOpen ? "" : " collapsed"}`}>
            {/* Controls */}
            <div className="controls">
              {/* Slim rail shown when collapsed — click to expand to the right */}
              <button
                type="button"
                className="controls-rail"
                onClick={() => setControlsOpen(true)}
                aria-label="Show your assumptions"
                aria-expanded={controlsOpen}
                aria-controls="assumptions-body"
              >
                <span className="controls-rail-icon" aria-hidden>
                  ›
                </span>
                <span className="controls-rail-text">Your assumptions</span>
                <span className={`controls-rail-case${preset ? "" : " custom"}`}>{caseLabel}</span>
              </button>

              {/* Full panel shown when expanded */}
              <div className="controls-full">
                <button
                  type="button"
                  className="controls-toggle"
                  onClick={() => setControlsOpen(false)}
                  aria-expanded={controlsOpen}
                  aria-controls="assumptions-body"
                >
                  <span className="controls-toggle-label">
                    <h3>Your assumptions</h3>
                  </span>
                  <span className="controls-toggle-cta">
                    <span className="chev" aria-hidden>
                      ‹
                    </span>
                    Hide
                  </span>
                </button>

                <div id="assumptions-body" className="controls-body-inner">
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
              </div>
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
                    {valid ? Math.round(fair).toLocaleString("en-US") : "–"}
                  </div>
                  <div className="assume" style={{ marginTop: 8 }}>
                    per share · today {price != null ? usd0(price) : "–"}
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
                        {gap != null ? signedPct(gap, 0) : "–"}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="sk">Implied enterprise value</div>
                      <div className="sv" style={{ color: "var(--ink)" }}>
                        {valid ? usdB(result.enterpriseValue, 0) : "–"}
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
                <MiniSeriesChart label="Assumed revenue growth by year" years={projLabels} values={growthSeries} format={fmtPct1} />
              </div>

              {valid && (
                <div className="proj-chart">
                  <TerminalShareBar pvExplicit={result.pvExplicit} pvTerminal={result.pvTerminal} />
                </div>
              )}

              {valid && price != null && (
                <div className="proj-chart">
                  <SensitivityHeatmap inputs={inputs} company={company} price={price} />
                </div>
              )}

              {valid ? (
                <p className="assumption-note" style={{ maxWidth: "none" }}>
                  {usdB(result.enterpriseValue, 0)} enterprise value + {usdB(company.netCash, 1)} net
                  cash = {usdB(result.equityValue, 0)} equity ÷ {company.sharesOutstanding.toFixed(2)}B
                  shares = ${fair.toFixed(0)}/share.
                </p>
              ) : (
                <p className="assumption-note" style={{ maxWidth: "none" }}>
                  These assumptions don&rsquo;t produce a finite value: the discount rate (WACC) must
                  exceed the perpetuity growth rate.
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="assumption-note" style={{ maxWidth: "none" }}>
          Today: <strong>{price != null ? usd0(price) : "–"}</strong> ·{" "}
          <span>~{company.sharesOutstanding.toFixed(2)}B</span> shares. A simplified 10-year DCF:
          growth fades to your terminal rate, FCF margin is held flat at your assumption, cash flows are
          discounted at your WACC, and a Gordon-growth perpetuity captures value beyond year 10. The discount rate
          is the annual return an investor requires. Educational, not a forecast or a recommendation.
        </p>
      </div>
    </section>
  );
}
