"use client";

/** Sticky header with the brand mark, anchor nav, and a LIVE ticker pill (price + day change). */
import { useOverview } from "./OverviewProvider";
import { usd2, signedPct, arrow } from "./format";

export function SiteHeader() {
  const { data, loading } = useOverview();
  const dp = data?.changePercent ?? null;
  const dir = dp == null ? "" : dp >= 0 ? "up" : "down";

  return (
    <header className="site">
      <div className="wrap nav">
        <div className="brand-mark">
          <span className="logo">
            <b>NOW</b> you know
          </span>
        </div>
        <nav className="links">
          <a href="#model">Model it</a>
          <a href="#news">What just happened</a>
          <a href="#movement">Basics</a>
        </nav>
        <div className="ticker-pill" title="Live delayed quote · Finnhub">
          <span className="sym">NOW</span>
          <span className="px mono">
            {loading ? "…" : data ? usd2(data.price) : "–"}
          </span>
          {dp != null && (
            <span className={`chg ${dir}`}>
              {arrow(dp)} {signedPct(dp).replace("+", "")}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
