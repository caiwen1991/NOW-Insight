"use client";

import type { BenchmarkSource } from "@/lib/company";
import { formatPercent } from "@/lib/format";

/**
 * A labeled percentage slider with STATIC benchmark reference text beside it.
 *
 * CLAUDE.md UI principles:
 *  - Benchmarks are static reference text — NO color-change behavior (it confused users).
 *  - Distinguish filings-derived benchmarks from convention-based ones (shown via a small tag).
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  benchmark,
  source,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  benchmark: string;
  source: BenchmarkSource;
  onChange: (next: number) => void;
}) {
  return (
    <div className="py-3 border-b border-line last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-ink">{label}</label>
        <span className="font-mono text-sm tabular-nums text-ink">
          {formatPercent(value)}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2 w-full accent-teal"
        aria-label={label}
      />

      <div className="mt-1 flex items-start gap-2">
        <SourceTag source={source} />
        <p className="text-xs text-muted">{benchmark}</p>
      </div>
    </div>
  );
}

function SourceTag({ source }: { source: BenchmarkSource }) {
  const isFilings = source === "filings";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isFilings ? "bg-teal-soft text-teal" : "bg-stone-soft text-muted"
      }`}
      title={
        isFilings
          ? "Benchmark derived from ServiceNow's public filings"
          : "Convention-based range, not company-specific"
      }
    >
      {isFilings ? "Filings" : "Convention"}
    </span>
  );
}
