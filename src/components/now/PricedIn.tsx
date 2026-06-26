"use client";

/**
 * "What today's price already assumes" — splits live market cap into a "proven business today"
 * slice (trailing FCF at a no-growth 15× multiple) and a "future growth premium" (the remainder).
 * Every figure is derived server-side in /api/overview from live price × live fundamentals.
 */
import { useOverview } from "./OverviewProvider";
import { usdB, mult, pct } from "./format";

export function PricedIn() {
  const { data } = useOverview();

  const todayPct = data ? (data.provenValue / data.marketCap) * 100 : 70;
  const growthPct = data ? (data.growthValue / data.marketCap) * 100 : 30;

  return (
    <section className="block" id="priced-in" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Expectations machine</div>
          <h2>What today&rsquo;s price already assumes</h2>
          <p className="lede">
            A stock price is the company now plus years of expected growth, pulled into the present.
          </p>
        </div>

        <div className="priced">
          <div className="decomp">
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Where NOW&rsquo;s <span>{data ? usdB(data.marketCap) : "—"}</span> market value comes from
            </div>
            <div className="bar">
              <span className="seg-today" style={{ width: `${todayPct}%` }} />
              <span className="seg-growth" style={{ width: `${growthPct}%` }} />
            </div>
            <div className="legend">
              <div className="legline">
                <span className="sw" style={{ background: "var(--sage)" }} />
                <div>
                  <div className="lab">Proven business today</div>
                  <div className="desc">
                    Trailing free cash flow valued as if growth stopped — about 15× FCF.
                  </div>
                </div>
                <div className="num mono">{data ? `~${usdB(data.provenValue, 0)}` : "—"}</div>
              </div>
              <div className="legline">
                <span className="sw" style={{ background: "var(--accent)" }} />
                <div>
                  <div className="lab">Future growth you&rsquo;re paying for</div>
                  <div className="desc">
                    The premium the market assigns to years of expected expansion.
                  </div>
                </div>
                <div className="num mono">{data ? `~${usdB(data.growthValue, 0)}` : "—"}</div>
              </div>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 22, marginBottom: 12 }}>Today&rsquo;s business vs. tomorrow&rsquo;s growth</h3>
            <p className="lede" style={{ fontSize: 18, marginBottom: 16 }}>
              Part of NOW&rsquo;s value is the cash it already generates; the rest is the growth
              investors expect. The growth slice rises and falls with the price — but it&rsquo;s
              always part of what you own.
            </p>
            <p style={{ color: "var(--ink-soft)", marginBottom: 16 }}>
              At <strong style={{ color: "var(--ink)" }}>{data ? `$${Math.round(data.price)}` : "—"}</strong>,
              NOW trades at{" "}
              <strong style={{ color: "var(--ink)" }}>
                {data ? `${mult(data.priceToSales)} sales` : "—"}
              </strong>{" "}
              and{" "}
              <strong style={{ color: "var(--ink)" }}>
                {data && Number.isFinite(data.priceToFcf) ? `${mult(data.priceToFcf, 0)} free cash flow` : "—"}
              </strong>
              , on roughly{" "}
              <strong style={{ color: "var(--ink)" }}>{data ? pct(data.fcfMargin) : "—"}</strong> FCF
              margins.
            </p>
            <p style={{ color: "var(--ink-soft)", marginTop: 16 }}>
              Bottom line: about <strong>{data ? `~${pct(data.growthShare)}` : "—"}</strong> of
              today&rsquo;s price is growth that hasn&rsquo;t happened yet. Pressure-test it in the
              model below.
            </p>
          </div>
        </div>
        <div className="assumption-note" style={{ maxWidth: "none" }}>
          Method: &ldquo;today&rsquo;s business&rdquo; ≈ trailing free cash flow at a no-growth 15×
          multiple; the remainder is the market&rsquo;s growth premium. A teaching split, not a formal
          valuation. Live price via Finnhub; revenue &amp; cash-flow margin via SEC EDGAR.
        </div>
      </div>
    </section>
  );
}
