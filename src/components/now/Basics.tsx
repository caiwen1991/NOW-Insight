/**
 * "Stock movement basics" — three explainer cards (static educational copy) on what moves the stock.
 */
import {
  TargetIcon,
  GlobeIcon,
  MessageCircleIcon,
  TrendingDownIcon,
  WavesIcon,
  SparklesIcon,
} from "./icons";

export function Basics() {
  return (
    <section className="block" id="movement">
      <div className="wrap">
        <div className="section-head">
          <h2>Stock movement basics</h2>
          <p className="lede">A quick primer on the daily wiggle.</p>
        </div>
        <div className="cards c3">
          <div className="card">
            <div className="ic">
              <TargetIcon />
            </div>
            <h3>Results vs. expectations</h3>
            <p>
              A great quarter can still drop the stock if it beat by less than the market hoped. Price
              reacts to the <em>gap</em> between reality and what was already assumed.
            </p>
            <div className="meta tagneg">
              <TrendingDownIcon /> &ldquo;Beat &amp; raise,&rdquo; stock can still fall
            </div>
          </div>
          <div className="card">
            <div className="ic">
              <GlobeIcon />
            </div>
            <h3>The macro tide</h3>
            <p>
              Interest rates, AI sentiment, and the broader software trade lift or sink most names at
              once. When money gets pricier, fast-growing stocks usually de-rate the most.
            </p>
            <div className="meta">
              <WavesIcon /> Rates · risk appetite · sector flows
            </div>
          </div>
          <div className="card">
            <div className="ic">
              <MessageCircleIcon />
            </div>
            <h3>The narrative</h3>
            <p>
              New stories re-rate the multiple: an AI product ramp, a big acquisition, a guidance
              change. The same earnings can be worth more, or less, as the story shifts.
            </p>
            <div className="meta tagpos">
              <SparklesIcon /> Now Assist AI · platform expansion
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
