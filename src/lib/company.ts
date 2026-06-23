/**
 * ServiceNow (NOW) company facts and model defaults.
 *
 * EVERY figure here must come from PUBLIC sources (SEC EDGAR filings, public market data) — see
 * CLAUDE.md hard rules. Each value carries a comment noting its source and as-of date. Refresh
 * these from the latest filings periodically (see lib/edgar.ts for the EDGAR endpoints).
 *
 * Units match lib/dcf.ts: monetary values in $B, shares in billions. All figures POST-SPLIT
 * (5-for-1, effective 2025-12-17) where per-share.
 */

import type { DcfCompany, DcfInputs } from "./dcf";

/** As-of label shown in the UI so readers know how fresh the fundamentals are. */
export const FUNDAMENTALS_AS_OF = "FY2025 results / latest 10-Q (approx.)";

export const NOW_COMPANY: DcfCompany = {
  // TTM revenue base. CLAUDE.md reference: FY25 ~$13.3B, TTM ~$14B.
  // Source: EDGAR tag RevenueFromContractWithCustomerExcludingAssessedTax (sum of last 4 quarters).
  ttmRevenue: 14.0, // $B

  // Current FCF margin. CLAUDE.md reference: FY25 ~31% (management targeting ~35%).
  // Source: NetCashProvidedByUsedInOperatingActivities − PaymentsToAcquirePropertyPlantAndEquipment,
  //         over TTM, divided by TTM revenue.
  currentFcfMargin: 0.31,

  // Net cash position ($B), cash & investments minus total debt. NOW is in a NET CASH position.
  // ~latest 10-Q (cash + marketable securities, no current debt). The Valuation route refreshes
  // this LIVE from EDGAR (lib/edgar.ts fetchNetCash); this value is the DCF basis + the fallback.
  netCash: 7.9, // $B

  // Current post-split shares outstanding. CLAUDE.md reference: ~1.03B (post 5-for-1 split).
  // The Valuation route refreshes this LIVE from EDGAR (lib/edgar.ts fetchSharesOutstanding, the
  // dei cover-page count); this value is the DCF basis + the fallback. Source: latest 10-Q cover page.
  sharesOutstanding: 1.03, // billions
};

/** Ticker used for the live price lookup. NOW = ServiceNow. NEVER SNOW (that's Snowflake). */
export const TICKER = "NOW";

/** Broad-market proxy for the daily-move decomposition (S&P 500 ETF). */
export const MARKET_PROXY = "SPY";

/** Software-sector proxy for the daily-move decomposition (iShares Expanded Tech-Software ETF). */
export const SECTOR_PROXY = "IGV";

/** Default slider positions — a reasonable, clearly-labeled starting scenario (not a recommendation). */
export const DEFAULT_INPUTS: DcfInputs = {
  year1Growth: 0.21, // ~ recent YoY revenue growth
  terminalGrowth: 0.03, // long-run, GDP-like
  terminalFcfMargin: 0.35, // management's stated target
  wacc: 0.09, // large-cap software convention
  perpetuityGrowth: 0.025, // <= long-run GDP
};

/**
 * Whether a benchmark is derived from the COMPANY's own filings, or is a CONVENTION-based range.
 * CLAUDE.md: it's honest to distinguish these. Company-specific benchmarks (growth, margin) come
 * from filings; terminal growth, WACC, and perpetuity are convention-based ranges.
 */
export type BenchmarkSource = "filings" | "convention";

export interface SliderConfig {
  key: keyof DcfInputs;
  label: string;
  /** Slider bounds and step, as decimals. */
  min: number;
  max: number;
  step: number;
  /** Static reference text shown beside the slider (NO color-change behavior — it confused users). */
  benchmark: string;
  source: BenchmarkSource;
}

export const SLIDERS: SliderConfig[] = [
  {
    key: "year1Growth",
    label: "Year-1 revenue growth",
    min: -0.1,
    max: 0.6,
    step: 0.005,
    benchmark: "Recent NOW growth ~20–22% YoY (FY25 ~21%); cRPO growth ~22%.",
    source: "filings",
  },
  {
    key: "terminalGrowth",
    label: "Terminal revenue growth (year 10)",
    min: 0.0,
    max: 0.1,
    step: 0.0025,
    benchmark: "Convention: long-run GDP-like, ~2–4%.",
    source: "convention",
  },
  {
    key: "terminalFcfMargin",
    label: "Terminal FCF margin (year 10)",
    min: 0.1,
    max: 0.5,
    step: 0.005,
    benchmark: "NOW FY25 FCF margin ~31%; management targets ~35%.",
    source: "filings",
  },
  {
    key: "wacc",
    label: "Discount rate (WACC)",
    min: 0.05,
    max: 0.15,
    step: 0.0025,
    benchmark: "Convention: large-cap software, ~8–10%.",
    source: "convention",
  },
  {
    key: "perpetuityGrowth",
    label: "Perpetuity growth",
    min: 0.0,
    max: 0.05,
    step: 0.0025,
    benchmark: "Convention: at or below long-run GDP, ~2–3%.",
    source: "convention",
  },
];
