import type { Metadata } from "next";
import { TopSection } from "@/components/TopSection";
import { DailyMove } from "@/components/DailyMove";

export const metadata: Metadata = {
  title: "Daily move — NOW Insight",
  description:
    "How much of ServiceNow (NOW)'s daily move is the broad market, the software sector, or company-specific. Educational only — not investment advice.",
};

export default function DailyMovePage() {
  return (
    <>
      <TopSection current="daily-move" />

      <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
        <p className="mb-8 max-w-3xl text-lg font-semibold text-teal">
          See how much of today&rsquo;s move is the market, the software sector, or NOW itself.
        </p>

        <DailyMove />

        <section className="mt-10 max-w-3xl space-y-3 text-sm text-muted">
          <h2 className="text-base font-semibold text-ink">How this is calculated</h2>
          <p>
            We split NOW&rsquo;s daily percentage change into three additive parts using a
            broad-market proxy (SPY) and a software-sector proxy (IGV):{" "}
            <strong>market</strong> (SPY), <strong>sector-specific</strong> (IGV minus SPY — how much
            software moved beyond the market), and <strong>company-specific</strong> (NOW minus IGV —
            how much NOW moved beyond its sector). By construction these three add up exactly to
            NOW&rsquo;s move. This assumes a beta of about 1 to each benchmark — a deliberate
            simplification for now, not a fitted model.
          </p>
          <p>
            During market hours the figures are <strong>provisional</strong>: they&rsquo;re computed
            from the latest delayed price and keep shifting until they settle after the 4:00pm ET
            close. SEC filings come from EDGAR (public domain); press headlines come from a
            third-party feed and are shown as context only.
          </p>
          <p className="text-muted">
            Prices are delayed. This is an educational tool, not investment advice, and is not
            affiliated with ServiceNow. (Before public launch: verify the news provider&rsquo;s terms
            permit public display of headlines.)
          </p>
        </section>
      </div>
    </>
  );
}
