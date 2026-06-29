"use client";

/**
 * "The long view" — folded into the Stock-movement-basics section as a sub-block (not its own
 * section). The line is the vetted split-adjusted monthly-close snapshot (lib/history.ts) with the
 * LIVE current price appended as the final point, so it always ends on today's real quote. Milestone
 * copy is editorial context, not market data. Renders inside OverviewProvider (via Basics).
 */
import { useState } from "react";
import { useOverview } from "./OverviewProvider";
import { NOW_MONTHLY_CLOSES } from "@/lib/history";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function TimelineChart({ current }: { current: number | null }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // Monthly snapshot through the last complete month, with today's LIVE price appended as the
  // in-progress current month so the line always ends on the real quote.
  const series = [
    ...NOW_MONTHLY_CLOSES,
    ...(current != null ? [{ year: currentYear, month: currentMonth, close: current }] : []),
  ];

  const W = 1000;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  // Continuous time axis in fractional years so calendar-year ticks line up.
  const t = (d: { year: number; month: number }) => d.year + (d.month - 1) / 12;
  const vals = series.map((d) => d.close);
  const minT = t(series[0]);
  const maxT = t(series[series.length - 1]);
  const maxV = Math.ceil(Math.max(...vals) / 50) * 50;
  const x = (d: { year: number; month: number }) =>
    padL + ((t(d) - minT) / (maxT - minT || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxV) * (H - padT - padB);

  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(d).toFixed(1)},${y(d.close).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series[series.length - 1]).toFixed(1)},${(H - padB).toFixed(1)} L${x(series[0]).toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const gridVals = [0, maxV / 2, maxV];
  // One tick per year (use each year's first available month), every other year to avoid crowding.
  const yearTicks = Array.from(new Set(series.map((d) => d.year)))
    .filter((_, i) => i % 2 === 0)
    .map((yr) => series.find((d) => d.year === yr)!);
  const last = series[series.length - 1];

  // Hover: snap the cursor to the nearest annual data point. Because the SVG uses
  // preserveAspectRatio="none", viewBox coords map linearly onto the container, so the
  // tooltip can be positioned by percentage of the container's width/height.
  const [hover, setHover] = useState<number | null>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width; // 0..1 across container
    const vbX = frac * W; // back into viewBox x units
    let nearest = 0;
    let best = Infinity;
    series.forEach((d, i) => {
      const dist = Math.abs(x(d) - vbX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  const hp = hover != null ? series[hover] : null;

  return (
    <div
      style={{ position: "relative" }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
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
        {yearTicks.map((d) => (
          <text key={d.year} x={x(d)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
            {d.year}
          </text>
        ))}
        {hp && (
          <line
            x1={x(hp)}
            x2={x(hp)}
            y1={padT}
            y2={H - padB}
            stroke="var(--ink-faint)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {current != null && (
          <circle cx={x(last)} cy={y(last.close)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        )}
        {hp && (
          <circle cx={x(hp)} cy={y(hp.close)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hp) / W) * 100}%`,
            top: `${(y(hp.close) / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
            pointerEvents: "none",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "6px 10px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          <div style={{ fontFamily: "var(--font-plex), monospace", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
            ${hp.close.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            {hp === last && current != null
              ? `${MONTH_NAMES[hp.month]} ${hp.year} · current`
              : `${MONTH_NAMES[hp.month]} ${hp.year}`}
          </div>
        </div>
      )}
    </div>
  );
}

export function LongView() {
  const { data } = useOverview();
  return (
    <div className="longview">
      <div className="longview-head">
        <h3>A decade-plus of compounding and volatility</h3>
        <p className="lede">
          NOW has multiplied many times over since IPO, with several gut-check drawdowns along the way.
        </p>
      </div>

      <div className="timeline-chart">
        <TimelineChart current={data?.price ?? null} />
        <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "right" }}>
          Approximate split-adjusted monthly closes · current price live
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
  );
}
