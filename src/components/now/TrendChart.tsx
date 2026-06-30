"use client";

/**
 * Hero trend chart: a LIVE price line for NOW with selectable timeframes (1D…MAX), fed by
 * /api/series (Twelve Data, server-side). While a range is loading — or if history is unavailable
 * (e.g. no TWELVE_DATA_API_KEY yet) — it falls back to the ambient AnimatedSparkline so the card
 * never looks broken. The line is always the brand accent (no red/green up/down coloring, matching
 * the project's neutral-verdict rule); direction is conveyed by the shape, not color.
 */
import { useEffect, useRef, useState } from "react";
import { useOverview } from "./OverviewProvider";
import { usd2 } from "./format";

const RANGES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

interface Point {
  t: number;
  c: number;
}

/**
 * Ambient sparkline animation — a smooth scrolling mean-reverting random walk. Used only as a
 * decorative fallback now (while the real series loads or when history is unavailable); it is
 * aria-hidden and intentionally NOT tied to real data. Honors prefers-reduced-motion.
 */
function AnimatedSparkline() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!svg || !path) return;

    const PAD_Y = 8;
    const VIS = 40;
    const N = VIS + 1;
    const STEP_MS = 600;

    let W = svg.clientWidth || 320;
    let H = svg.clientHeight || 56;
    let dx = W / (VIS - 1);
    const sync = () => {
      W = svg.clientWidth || W;
      H = svg.clientHeight || H;
      dx = W / (VIS - 1);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(svg);

    const nextVal = (prev: number) => prev - prev * 0.06 + (Math.random() - 0.5) * 2.4;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const buf: number[] = [];
    let v = 0;
    for (let i = 0; i < N; i++) buf.push((v = nextVal(v)));

    const render = (frac: number) => {
      let min = Infinity;
      let max = -Infinity;
      for (const val of buf) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const span = max - min || 1;
      const yOf = (val: number) => H - PAD_Y - ((val - min) / span) * (H - 2 * PAD_Y);

      let d = "";
      for (let i = 0; i < N; i++) {
        d += `${i === 0 ? "M" : "L"}${((i - frac) * dx).toFixed(1)},${yOf(buf[i]).toFixed(1)} `;
      }
      path.setAttribute("d", d.trim());

      const tipX = W - 4;
      const fi = tipX / dx + frac;
      const i0 = Math.max(0, Math.min(N - 2, Math.floor(fi)));
      const tipY = lerp(yOf(buf[i0]), yOf(buf[i0 + 1]), fi - i0);
      for (const c of [tipRef.current, haloRef.current]) {
        c?.setAttribute("cx", String(tipX));
        c?.setAttribute("cy", tipY.toFixed(1));
      }
    };

    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      render(0);
      ro.disconnect();
      return;
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (ts: number) => {
      acc += (ts - last) / STEP_MS;
      last = ts;
      while (acc >= 1) {
        acc -= 1;
        buf.push(nextVal(buf[buf.length - 1]));
        buf.shift();
      }
      render(acc);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <svg ref={svgRef} className="trend-svg" aria-hidden="true">
      <path
        ref={pathRef}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle ref={haloRef} id="spk-halo" r={3} fill="var(--accent)" opacity={0.35} />
      <circle ref={tipRef} r={2.4} fill="var(--accent)" />
    </svg>
  );
}

/** X-axis tick label, formatted to suit the range (time for 1D, weekday for 1W, year for 5Y/MAX, else date). */
function fmtTick(t: number, range: Range): string {
  const d = new Date(t);
  if (range === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString("en-US", { weekday: "short" });
  if (range === "5Y" || range === "MAX") return String(d.getFullYear());
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Full timestamp for the hover tooltip (date+time for intraday, month+year for the long ranges). */
function fmtStamp(t: number, range: Range): string {
  const d = new Date(t);
  if (range === "1D" || range === "1W")
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (range === "5Y" || range === "MAX")
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Pixel-measured price line with an x-axis timeline and a hover crosshair + tooltip. It measures its
 * own box via ResizeObserver so geometry is in real pixels (axis text isn't aspect-distorted), and
 * hover maps the cursor's x to the nearest data point, showing its price and timestamp.
 */
function TrendPlot({
  points,
  range,
  baseline,
  baselineUp,
}: {
  points: Point[];
  range: Range;
  baseline?: number | null;
  // Direction of the current price vs. the baseline (prev close / 12am price): true = up, false = down.
  // Colors the price LINE green/red. null leaves it the neutral brand accent (non-1D ranges).
  baselineUp?: boolean | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset any stale hover when the series changes (e.g. switching timeframe).
  useEffect(() => setHover(null), [points]);

  const { w, h } = size;
  const padT = 8;
  const axisH = 18; // bottom strip reserved for x-axis labels
  const plotH = Math.max(1, h - padT - axisH);
  const n = points.length;

  const cs = points.map((p) => p.c);
  let min = Math.min(...cs);
  let max = Math.max(...cs);
  // Keep the baseline (e.g. previous close on 1D) in view so the reference line is always visible.
  if (baseline != null) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  const span = max - min || 1;

  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (c: number) => padT + (1 - (c - min) / span) * plotH;

  // Price line color: green/red by today's direction (vs. yesterday's close) on 1D; neutral accent otherwise.
  const lineColor = baselineUp == null ? "var(--accent)" : baselineUp ? "var(--pos)" : "var(--neg)";

  const d = w > 0 ? points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ") : "";

  // ~4 evenly spaced ticks, offset from the edges so end labels don't clip.
  const TICKS = 4;
  const tickIdx = n <= 1 ? [] : Array.from({ length: TICKS }, (_, k) => Math.round(((k + 0.5) / TICKS) * (n - 1)));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  }

  const hp = hover != null ? points[hover] : null;
  const hx = hover != null ? x(hover) : 0;
  const hy = hp ? y(hp.c) : 0;
  const tipLeft = Math.max(46, Math.min(w - 46, hx)); // keep the tooltip inside the card

  return (
    <div ref={ref} className="trend-svg" style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={h} aria-hidden="true" style={{ display: "block" }}>
          <line x1={0} x2={w} y1={padT + plotH} y2={padT + plotH} stroke="var(--hero-ink)" strokeOpacity={0.16} />
          {baseline != null && (
            <>
              <line x1={0} x2={w} y1={y(baseline)} y2={y(baseline)} stroke="var(--hero-ink)" strokeOpacity={0.34} strokeDasharray="4 3" />
              <text x={w - 2} y={y(baseline) - 4} textAnchor="end" fontSize={9} fill="var(--hero-ink-soft)">
                prev close {usd2(baseline)}
              </text>
            </>
          )}
          <path d={d} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {tickIdx.map((i) => (
            <text
              key={i}
              x={Math.max(14, Math.min(w - 14, x(i)))}
              y={h - 5}
              textAnchor="middle"
              fontSize={10}
              fill="var(--hero-ink-soft)"
            >
              {fmtTick(points[i].t, range)}
            </text>
          ))}
          {hp && (
            <>
              <line x1={hx} x2={hx} y1={padT} y2={padT + plotH} stroke="var(--hero-ink)" strokeOpacity={0.32} strokeDasharray="3 3" />
              <circle cx={hx} cy={hy} r={3.5} fill={lineColor} stroke="var(--hero-bg)" strokeWidth={2} />
            </>
          )}
        </svg>
      )}
      {hp && (
        <div className="trend-tip" style={{ left: tipLeft, top: hy }}>
          <div className="trend-tip-price">{usd2(hp.c)}</div>
          <div className="trend-tip-time">{fmtStamp(hp.t, range)}</div>
        </div>
      )}
    </div>
  );
}

export function TrendChart() {
  const [range, setRange] = useState<Range>("1D");
  // Series for the range that `drawn` was fetched for. We keep the previous line on screen while a new
  // range loads (instead of flashing the animation), so `drawn` tracks which range `points` belongs to.
  const [points, setPoints] = useState<Point[] | null>(null);
  const [drawn, setDrawn] = useState<Range | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/series?range=${range}`)
      .then((r) => r.json())
      .then((res: { source?: string; points?: Point[] }) => {
        if (cancelled) return;
        if (res?.source === "live" && Array.isArray(res.points) && res.points.length > 1) {
          setPoints(res.points);
          setDrawn(range);
        } else {
          setPoints(null);
          setDrawn(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPoints(null);
          setDrawn(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const { data } = useOverview();
  // Previous close = current price − today's change. Used as the 1D baseline (the standard "today"
  // reference) and drawn as a dashed line on the 1D chart.
  const prevClose = data?.change != null ? data.price - data.change : null;
  // Up if the current price is above yesterday's close (the 12am reference); drives the dashed line's color.
  const baselineUp = data?.change != null ? data.change >= 0 : null;

  const hasLine = points != null && points.length > 1 && drawn != null;

  // Change shown beside the timeframe. Suppressed while loading, and tied to the range the line was
  // actually drawn for (`drawn`). 1D is measured vs PREVIOUS CLOSE so it matches the header's
  // "+X% today" (NOW can gap up at the open yet be down intraday — an open-relative number would
  // contradict the header's sign). Every other range uses its own start-of-window.
  let delta: number | null = null;
  let deltaPct: number | null = null;
  if (!loading && hasLine) {
    if (drawn === "1D" && data?.change != null && data?.changePercent != null) {
      delta = data.change;
      deltaPct = data.changePercent;
    } else {
      delta = points![points!.length - 1].c - points![0].c;
      deltaPct = delta / points![0].c;
    }
  }

  return (
    <div className="trend">
      <div className={`trend-plot${loading ? " is-loading" : ""}`}>
        {hasLine ? (
          <TrendPlot
            points={points!}
            range={drawn!}
            baseline={drawn === "1D" ? prevClose : null}
            baselineUp={drawn === "1D" ? baselineUp : null}
          />
        ) : (
          <AnimatedSparkline />
        )}
      </div>

      <div className="trend-foot">
        <div className="trend-tabs" role="tablist" aria-label="Chart timeframe">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === range}
              className={`trend-tab${r === range ? " is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {delta != null && deltaPct != null && (
          <div className={`trend-delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? "+" : "−"}
            {usd2(Math.abs(delta))} ({(deltaPct * 100).toFixed(2)}%) · {drawn}
          </div>
        )}
      </div>
    </div>
  );
}
