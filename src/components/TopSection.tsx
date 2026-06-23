import { HomeHero } from "@/components/HomeHero";
import { SectionNav, type Section } from "@/components/SectionNav";

/**
 * The fixed top shell shown identically at the top of every page: headline → gap hero → the three
 * section cards. Navigating between sections leaves this block unchanged; only the content BELOW it
 * swaps. Pass `current` to mark which section card you're viewing.
 */
export function TopSection({ current }: { current?: Section }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">
        Make sense of ServiceNow (NOW) stock
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        An independent, educational project that explains what moves ServiceNow (NOW) and what
        today&rsquo;s price implies about the market&rsquo;s expectations — using only public data.
        Not investment advice, and not affiliated with ServiceNow.
      </p>

      <div className="mt-8">
        <HomeHero />
      </div>

      <div className="mt-8">
        <SectionNav current={current} />
      </div>
    </div>
  );
}
