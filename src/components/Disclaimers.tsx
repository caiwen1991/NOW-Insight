/**
 * Global disclaimers. CLAUDE.md hard rule: these must be PROMINENT on EVERY page.
 *
 * `DisclaimerBanner` renders at the very top of every page; `DisclaimerFooter` at the bottom.
 * Both are included once in the root layout (src/app/layout.tsx), so every route gets them.
 */

const DISCLAIMER_POINTS = [
  "Not investment advice",
  "Personal project",
  "Not affiliated with or endorsed by ServiceNow",
];

export function DisclaimerBanner() {
  return (
    <div className="w-full bg-amber-100 text-amber-900 border-b border-amber-300">
      <p className="mx-auto max-w-5xl px-4 py-2 text-center text-sm font-medium">
        {DISCLAIMER_POINTS.join(" · ")}
      </p>
    </div>
  );
}

export function DisclaimerFooter() {
  return (
    <footer className="mt-auto w-full border-t border-line bg-stone-soft text-muted">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm space-y-2">
        <p className="font-semibold text-ink">
          Important: {DISCLAIMER_POINTS.join(". ")}.
        </p>
        <p>
          NOW Insight is an independent, educational side project. Every figure is derived from
          public sources (SEC EDGAR filings and public market data). Nothing here is a
          recommendation to buy, sell, or hold any security.
        </p>
        <p>
          Market prices shown are <strong>delayed</strong> and provided for educational illustration
          only. Do your own research and consult a licensed financial professional before making any
          investment decision.
        </p>
      </div>
    </footer>
  );
}
