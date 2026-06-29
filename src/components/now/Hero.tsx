"use client";

/**
 * Hero: headline + CTAs, and a LIVE quote card (price, day delta, an interactive multi-timeframe
 * trend chart, and a compact single-row stats strip: market cap, today's range, 52-week range).
 * The trend chart lives in ./TrendChart (real price line via /api/series, with the ambient
 * animation as its loading/unavailable fallback).
 */
import { useOverview } from "./OverviewProvider";
import { usd2, usdB, arrow, signedPct } from "./format";
import { TrendChart } from "./TrendChart";

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
        : `Updated as of ${new Date(data.asOf).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`;

  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div>
          <h1>
            You own <em>NOW</em>. Now get to know it.
          </h1>
          <p className="lede">
            A simple tool built for anyone trying to make sense of NOW.
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
          <div className="price mono">{price != null ? usd2(price) : "–"}</div>
          <div className={`delta chg ${dir}`}>
            {change != null && changePct != null
              ? `${arrow(changePct)} ${change >= 0 ? "+" : "−"}$${Math.abs(change).toFixed(2)} (${signedPct(changePct).replace("+", "")}) today`
              : "day change unavailable"}
          </div>
          <TrendChart />
          <div className="quote-grid">
            <div>
              <div className="k">Market cap</div>
              <div className="v mono">{data ? usdB(data.marketCap) : "–"}</div>
            </div>
            <div>
              <div className="k">Today&rsquo;s range</div>
              <div className="v mono">
                {data?.dayLow != null && data?.dayHigh != null
                  ? `${usd2(data.dayLow)}–${usd2(data.dayHigh)}`
                  : "–"}
              </div>
            </div>
            <div>
              <div className="k">52-wk range</div>
              <div className="v mono">
                {data?.week52Low != null && data?.week52High != null
                  ? `${usd2(data.week52Low)}–${usd2(data.week52High)}`
                  : "–"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
