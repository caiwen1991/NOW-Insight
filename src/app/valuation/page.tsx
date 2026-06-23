import type { Metadata } from "next";
import { TopSection } from "@/components/TopSection";
import { Valuation } from "@/components/Valuation";

export const metadata: Metadata = {
  title: "Valuation context — NOW Insight",
  description:
    "Where ServiceNow (NOW) trades on EV/Revenue, EV/FCF and Rule of 40 versus its own history and a few software peers. Educational only — not investment advice.",
};

export default function ValuationPage() {
  return (
    <>
      <TopSection current="valuation" />

      <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
        <p className="mb-8 max-w-3xl text-lg font-semibold text-teal">
          See where NOW&rsquo;s valuation sits versus its own history and a few software peers.
        </p>

        <Valuation />

        <section className="mt-10 max-w-3xl space-y-3 text-sm text-muted">
          <h2 className="text-base font-semibold text-ink">How this is calculated</h2>
          <p>
            For each company we take a live (delayed) share price and combine it with public
            fundamentals to get enterprise value (EV = price × shares − net cash), then{" "}
            <strong>EV/Revenue</strong>, <strong>EV/FCF</strong> (free cash flow = revenue × FCF
            margin), and <strong>Rule of 40</strong> (revenue growth % + FCF margin %). Higher growth
            and margins generally justify higher multiples — that&rsquo;s the upward slope in the
            scatter, and the reason a raw multiple alone doesn&rsquo;t say &ldquo;cheap&rdquo; or
            &ldquo;expensive.&rdquo;
          </p>
          <p>
            Share prices are live for everyone, and for NOW <strong>both shares outstanding and net
            cash are pulled live from SEC EDGAR</strong> (latest 10-Q — post-split shares, and cash +
            marketable securities − debt). The remaining fundamentals — revenue, growth, FCF margin,
            and all peer figures (including their shares and net cash) — are <strong>approximate
            public snapshots</strong> hard-coded and refreshed manually; refresh them from each
            company&rsquo;s latest filings before relying on the figures. Peers shown: Salesforce,
            Workday, Adobe, Datadog.
          </p>
          <p className="text-muted">
            Prices are delayed. This is an educational tool, not investment advice, and is not
            affiliated with ServiceNow. Multiples are context to ground the reverse DCF, not a
            valuation or a recommendation.
          </p>
        </section>
      </div>
    </>
  );
}
