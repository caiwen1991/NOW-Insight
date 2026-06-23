import type { Metadata } from "next";
import { ReverseDcf } from "@/components/ReverseDcf";
import { TopSection } from "@/components/TopSection";

export const metadata: Metadata = {
  title: "Price modeler — NOW Insight",
  description:
    "A reverse discounted-cash-flow view of ServiceNow (NOW): adjust the assumptions and see what today's price implies. Educational only — not investment advice.",
};

export default function ReverseDcfPage() {
  return (
    <>
      <TopSection current="reverse-dcf" />

      <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
        <p className="mb-8 max-w-3xl text-lg font-semibold text-teal">
          Move the sliders to adjust the assumptions and build a scenario.
        </p>

        <ReverseDcf />

        <section className="mt-10 max-w-3xl space-y-3 text-sm text-muted">
          <h2 className="text-base font-semibold text-ink">How the model works</h2>
          <p>
            Revenue grows from the trailing-twelve-month base; the growth rate fades linearly from
            your Year-1 rate to your terminal rate over 10 years. The free-cash-flow margin ramps
            linearly from today&rsquo;s level to your terminal margin. Each year&rsquo;s free cash
            flow is discounted at your chosen WACC, a Gordon-growth terminal value caps off year 10,
            and net cash is added to get equity value. We work in enterprise-value terms (which are
            unaffected by the December 2025 5-for-1 stock split) and convert to a per-share figure
            only at the end, using the current post-split share count.
          </p>
          <p className="text-muted">
            Figures derive from public SEC filings and public market data. Prices are delayed. This
            is an educational tool, not investment advice, and is not affiliated with ServiceNow.
          </p>
        </section>
      </div>
    </>
  );
}
