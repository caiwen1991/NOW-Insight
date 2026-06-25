"use client";

/**
 * Hero: headline + CTAs, and a LIVE quote card (price, day delta, market cap, 52-week range,
 * revenue TTM, P/E). The sparkline is an ambient ANIMATION — a smooth scrolling random-walk that
 * evokes intraday stock movement. It is decorative (aria-hidden) and intentionally NOT tied to real
 * data, so we never imply a specific intraday history we don't have.
 */
import { useEffect, useRef } from "react";
import { useOverview } from "./OverviewProvider";
import { usd2, usdB, mult, arrow, signedPct } from "./format";

/**
 * Animated sparkline. A value buffer scrolls left one slot every STEP_MS (a mean-reverting random
 * walk), redrawn each animation frame with sub-step interpolation so the motion is continuous rather
 * than stepping. The viewBox tracks the element's pixel size (via ResizeObserver) so the line fills
 * the width and the tip stays a round dot. Honors prefers-reduced-motion by rendering one still frame.
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
    const VIS = 40; // visible points across the width
    const N = VIS + 1; // one extra incoming point on the right
    const STEP_MS = 600; // time to scroll one slot

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

      // Glowing tip pinned just inside the right edge, riding the line's height there.
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
    <svg ref={svgRef} className="spark" aria-hidden="true">
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

export function Hero() {
  const { data, loading } = useOverview();

  const price = data?.price ?? null;
  const change = data?.change ?? null;
  const changePct = data?.changePercent ?? null;
  const dir = changePct == null ? "" : changePct >= 0 ? "up" : "down";

  const asOf =
    data == null
      ? loading
        ? "connecting…"
        : "unavailable"
      : data.priceIsPlaceholder
        ? "placeholder price"
        : `delayed · ${new Date(data.asOf).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`;

  const range =
    data?.week52Low != null && data?.week52High != null
      ? `$${Math.round(data.week52Low)}–$${Math.round(data.week52High)}`
      : "—";

  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div>
          <div className="eyebrow">Make sense of your shares</div>
          <h1>
            You own <em>NOW</em>. Now get to know it.
          </h1>
          <p className="lede">
            A plain-English guide to why ServiceNow&rsquo;s stock moves, what today&rsquo;s price
            already assumes, and how to model where it could go — built for anyone trying to make
            sense of NOW.
          </p>
          <div className="hero-cta">
            <a href="#model" className="btn btn-primary">
              Model the stock <span aria-hidden="true">→</span>
            </a>
            <a href="#movement" className="btn btn-ghost">
              Start with the basics
            </a>
          </div>
        </div>

        {/* Quote card */}
        <div className="quote-card">
          <div className="row1">
            <div>
              <div className="sym">ServiceNow, Inc.</div>
              <div className="exch">NYSE: NOW</div>
            </div>
            <div className="exch" style={{ textAlign: "right" }}>
              {asOf}
            </div>
          </div>
          <div className="price mono">{price != null ? usd2(price) : "—"}</div>
          <div className={`delta chg ${dir}`}>
            {change != null && changePct != null
              ? `${arrow(changePct)} ${change >= 0 ? "+" : "−"}$${Math.abs(change).toFixed(2)} (${signedPct(changePct).replace("+", "")}) today`
              : "day change unavailable"}
          </div>
          <AnimatedSparkline />
          <div className="quote-grid">
            <div>
              <div className="k">Market cap</div>
              <div className="v mono">{data ? usdB(data.marketCap) : "—"}</div>
            </div>
            <div>
              <div className="k">52-wk range</div>
              <div className="v mono">{range}</div>
            </div>
            <div>
              <div className="k">Revenue (TTM)</div>
              <div className="v mono">{data ? usdB(data.revenueTtm) : "—"}</div>
            </div>
            <div>
              <div className="k">P/E (TTM)</div>
              <div className="v mono">{data?.peTtm != null ? mult(data.peTtm, 0) : "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
