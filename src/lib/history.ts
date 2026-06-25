/**
 * Vetted, APPROXIMATE split-adjusted annual closing prices for NOW — a public-market-data snapshot
 * used only for the long-run history chart's shape. Same accepted pattern as the peer/history
 * snapshots in lib/valuation.ts (and the legal copy already labels history "approximate annual
 * closes"). Every other number on the site is live; this series is the single labeled exception.
 *
 * Basis: POST-SPLIT (5-for-1, effective 2025-12-17). Pre-split nominal year-end closes are divided
 * by 5 so the whole line is consistent with today's live post-split price. Refresh from public data.
 *
 * The current year's point is NOT stored here — the page appends today's LIVE price as the latest
 * point so the line always ends on the real, current quote.
 */

export interface AnnualClose {
  /** Calendar year of the close. */
  year: number;
  /** Approximate split-adjusted year-end close, USD (post-split basis). */
  close: number;
}

/** Approximate split-adjusted annual closes, 2012 → 2025. Current year appended live by the page. */
export const NOW_ANNUAL_CLOSES: AnnualClose[] = [
  { year: 2012, close: 6 },
  { year: 2013, close: 11 },
  { year: 2014, close: 14 },
  { year: 2015, close: 17 },
  { year: 2016, close: 15 },
  { year: 2017, close: 26 },
  { year: 2018, close: 36 },
  { year: 2019, close: 57 },
  { year: 2020, close: 110 },
  { year: 2021, close: 130 },
  { year: 2022, close: 78 },
  { year: 2023, close: 141 },
  { year: 2024, close: 212 },
  { year: 2025, close: 95 },
];
