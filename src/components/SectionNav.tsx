import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The three Phase-1 section cards, shown on the homepage AND at the top of each section page so
 * they act as persistent navigation. Pass `current` on a section page to mark that card as the
 * one you're viewing (it renders as a non-link "you're here" card instead of a link).
 *
 * Only "Implied expectations" (/reverse-dcf) is built; the other two render as "coming next".
 */

export type Section = "reverse-dcf" | "daily-move" | "valuation";

export function SectionNav({ current }: { current?: Section }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ToolCard
        href="/reverse-dcf"
        icon={<DialsIcon className="h-5 w-5" />}
        title="Price modeler"
        desc="Back out the growth and margins needed to justify today's price, and move the assumptions yourself."
        current={current === "reverse-dcf"}
      />
      <ToolCard
        href="/daily-move"
        icon={<PulseIcon className="h-5 w-5" />}
        title="Daily move"
        desc="How much of a day's move is the market and sector versus company-specific."
        current={current === "daily-move"}
      />
      <ToolCard
        href="/valuation"
        icon={<BarsIcon className="h-5 w-5" />}
        title="Valuation context"
        desc="Where NOW's multiples sit versus its own history and a few peers."
        current={current === "valuation"}
      />
    </div>
  );
}

/**
 * A section card. Precedence:
 *  - `current`   → non-link "you're here" card (teal border + accent)
 *  - `href`      → active link card
 *  - otherwise   → dashed "coming next" card
 * Borders stay 1px in every state so the grid never shifts when one card is marked current.
 */
function ToolCard({
  href,
  icon,
  title,
  desc,
  current,
  comingSoon,
}: {
  href?: string;
  icon: ReactNode;
  title: string;
  desc: string;
  current?: boolean;
  comingSoon?: boolean;
}) {
  const chip = (active: boolean) => (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
        active ? "bg-teal-soft text-teal" : "bg-stone-soft text-muted"
      }`}
    >
      {icon}
    </span>
  );

  if (current) {
    return (
      <div className="rounded-xl border border-teal bg-white p-5">
        <div className="flex items-center gap-3">
          {chip(true)}
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-muted">{desc}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-teal">You&rsquo;re here</p>
      </div>
    );
  }

  if (href && !comingSoon) {
    return (
      <Link
        href={href}
        className="group rounded-xl border border-line bg-white p-5 transition hover:border-teal"
      >
        <div className="flex items-center gap-3">
          {chip(true)}
          <h2 className="text-base font-semibold text-ink group-hover:text-teal">{title} →</h2>
        </div>
        <p className="mt-2 text-sm text-muted">{desc}</p>
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-paper p-5">
      <div className="flex items-center gap-3">
        {chip(false)}
        <h2 className="text-base font-semibold text-muted">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted">{desc}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">Coming next</p>
    </div>
  );
}

/* Inline SVG icons — no icon dependency added (CLAUDE.md: ask before introducing new deps). */

function DialsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="21" y1="6" x2="15" y2="6" />
      <line x1="11" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="13" y2="12" />
      <line x1="9" y1="12" x2="3" y2="12" />
      <line x1="21" y1="18" x2="17" y2="18" />
      <line x1="13" y1="18" x2="3" y2="18" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="11" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function BarsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="7" y1="21" x2="7" y2="13" />
      <line x1="12" y1="21" x2="12" y2="7" />
      <line x1="17" y1="21" x2="17" y2="15" />
    </svg>
  );
}
