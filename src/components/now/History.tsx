"use client";

/**
 * Long-run price history. The line is the vetted split-adjusted annual-close snapshot
 * (lib/history.ts) with the LIVE current price appended as the final point, so it always ends on
 * today's real quote. Milestone copy is editorial context, not market data.
 */
import { useOverview } from "./OverviewProvider";
import { NOW_ANNUAL_CLOSES } from "@/lib/history";

function TimelineChart({ current }: { current: number | null }) {
  const currentYear = new Date().getFullYear();
  const series = [
    ...NOW_ANNUAL_CLOSES,
    ...(current != null ? [{ year: currentYear, close: current }] : []),
  ];

  const W = 1000;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const years = series.map((d) => d.year);
  const vals = series.map((d) => d.close);
  const minY = years[0];
  const maxY = years[years.length - 1];
  const maxV = Math.ceil(Math.max(...vals) / 50) * 50;
  const x = (yr: number) => padL + ((yr - minY) / (maxY - minY || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxV) * (H - padT - padB);

  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.year).toFixed(1)},${y(d.close).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxY).toFixed(1)},${(H - padB).toFixed(1)} L${x(minY).toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const gridVals = [0, maxV / 2, maxV];
  const xTicks = series.filter((_, i) => i % 2 === 0 || i === series.length - 1);
  const last = series[series.length - 1];

  return (
    <svg className="tl-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="ServiceNow split-adjusted price, 2012 to present">
      <defs>
        <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((gv) => (
        <g key={gv}>
          <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="var(--line)" strokeWidth={1} />
          <text x={padL - 8} y={y(gv) + 4} textAnchor="end" fontSize={11} fill="var(--ink-faint)">
            ${gv}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#tl-fill)" stroke="none" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {xTicks.map((d) => (
        <text key={d.year} x={x(d.year)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
          {d.year}
        </text>
      ))}
      {current != null && (
        <circle cx={x(last.year)} cy={y(last.close)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
      )}
    </svg>
  );
}

export function History() {
  const { data } = useOverview();
  return (
    <section className="block" id="history" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">The long view</div>
          <h2>A decade-plus of compounding — and volatility</h2>
          <p className="lede">
            Great long-term stocks rarely go up in a straight line. NOW has multiplied many times over
            since IPO, with several gut-check drawdowns along the way.
          </p>
        </div>

        <div className="timeline-chart">
          <TimelineChart current={data?.price ?? null} />
          <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "right" }}>
            Approximate split-adjusted annual closes · current price live
          </div>
        </div>

        <div className="milestones">
          <div className="ms">
            <div className="yr">2012</div>
            <div className="t">IPO at ~$18</div>
            <div className="d">Debuts on the NYSE as the workflow platform for IT.</div>
          </div>
          <div className="ms">
            <div className="yr">2020–21</div>
            <div className="t">Cloud super-cycle</div>
            <div className="d">Digital transformation sends shares to new highs.</div>
          </div>
          <div className="ms">
            <div className="yr">2024</div>
            <div className="t">~$212 all-time high</div>
            <div className="d">AI optimism crowns it a &ldquo;class of one&rdquo; compounder.</div>
          </div>
          <div className="ms">
            <div className="yr">2025</div>
            <div className="t">5-for-1 split · pullback</div>
            <div className="d">Shares split, then de-rate on AI-disruption fears.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
