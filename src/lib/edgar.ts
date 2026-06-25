/**
 * SEC EDGAR helpers — fundamentals are free, public domain, and redistributable.
 *
 * This module is intended for SERVER-SIDE / scripted refresh of the figures in lib/company.ts.
 * It is not wired into the live page yet (Phase 1 hard-codes vetted figures and refreshes them
 * manually). It documents the exact endpoints and gotchas so refreshing stays correct.
 *
 * GOTCHAS (CLAUDE.md):
 *  - EDGAR requires a `User-Agent` header with a name + email, or requests get a 403.
 *  - Each data point has `start` and `end`. Period length = end − start. 3 months = single quarter;
 *    12 months = full year; 6/9 months = year-to-date cumulative (usually EXCLUDE to avoid
 *    double-counting). Cash-flow figures are especially prone to YTD accumulation.
 *  - Share counts in older filings are PRE-SPLIT (5-for-1 effective 2025-12-17). Do not mix bases.
 */

/** ServiceNow's SEC CIK (zero-padded form used in the API path). */
export const NOW_CIK = "0001373715";

/**
 * Identify the app per SEC fair-access policy. SEC requests a contact (email or site); EDGAR also
 * responds to a descriptive name-only agent, which is what we use here to avoid publishing a
 * personal email. If you start seeing 403s under heavier traffic, add a contact via an env var.
 */
export const EDGAR_USER_AGENT = "NOW Insight (educational, non-commercial)";

/** Validated GAAP tags confirmed to return data for NOW (CLAUDE.md). */
export const EDGAR_TAGS = {
  revenue: "RevenueFromContractWithCustomerExcludingAssessedTax",
  operatingIncome: "OperatingIncomeLoss",
  operatingCashFlow: "NetCashProvidedByUsedInOperatingActivities",
  capex: "PaymentsToAcquirePropertyPlantAndEquipment",
  dilutedShares: "WeightedAverageNumberOfDilutedSharesOutstanding", // units keyed by `shares`, not USD
} as const;

export function companyConceptUrl(tag: string): string {
  return `https://data.sec.gov/api/xbrl/companyconcept/CIK${NOW_CIK}/us-gaap/${tag}.json`;
}

interface EdgarUnitDatum {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string;
}

interface CompanyConceptResponse {
  units: Record<string, EdgarUnitDatum[]>;
}

/** Days between two ISO dates (YYYY-MM-DD). */
function periodDays(start: string | undefined, end: string): number | null {
  if (!start) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

/** True for a roughly-one-quarter (≈90-day) period. Use to keep only discrete quarters. */
export function isQuarterly(d: EdgarUnitDatum): boolean {
  const days = periodDays(d.start, d.end);
  return days !== null && days >= 80 && days <= 100;
}

/**
 * Fetch a us-gaap concept for NOW. Returns the raw unit data points; callers filter by period
 * (e.g. `isQuarterly`) and pick the trailing four quarters for TTM figures.
 *
 * NOTE: includes the required User-Agent header. Intended for server/script use only.
 */
export async function fetchConcept(
  tag: string,
  unit = "USD"
): Promise<EdgarUnitDatum[]> {
  const res = await fetch(companyConceptUrl(tag), {
    headers: { "User-Agent": EDGAR_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`EDGAR ${tag} request failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as CompanyConceptResponse;
  const series = json.units[unit];
  if (!series) {
    const available = Object.keys(json.units).join(", ");
    throw new Error(`EDGAR ${tag}: unit "${unit}" not found. Available units: ${available}`);
  }
  return series;
}

/** Sum the latest four discrete quarters of a concept → a trailing-twelve-month figure. */
export function trailingTwelveMonths(series: EdgarUnitDatum[]): number {
  const quarters = series
    .filter(isQuarterly)
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
  return quarters.slice(0, 4).reduce((sum, q) => sum + q.val, 0);
}

/**
 * Net cash = cash & equivalents + marketable securities − financial debt, computed live from EDGAR.
 *
 * Balance-sheet concepts are INSTANT (a single `end` date, no period). We anchor on the latest cash
 * reporting date and count each tag's value AT that date only — so tags the company has stopped
 * reporting (e.g. debt it has repaid) naturally contribute 0 rather than a stale figure.
 *
 * Validated for NOW (2026): cash uses CashAndCashEquivalentsAtCarryingValue; investments use the
 * AvailableForSaleSecuritiesDebtSecurities current/noncurrent tags; no current debt tags return data.
 */
const NETCASH_CASH_TAGS = [
  "CashAndCashEquivalentsAtCarryingValue",
  "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
  "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent",
];
const NETCASH_DEBT_TAGS = [
  "LongTermDebtNoncurrent",
  "LongTermDebtCurrent",
  "LongTermDebt",
  "ConvertibleDebtNoncurrent",
  "SeniorNotesNoncurrent",
];

export interface NetCashResult {
  /** Net cash in $B (cash + investments − debt). */
  netCash: number;
  /** Balance-sheet date the figure is as-of (ISO YYYY-MM-DD). */
  asOf: string;
}

/** Fetch a concept's instant series for a taxonomy + unit. Empty on any error. Cached ~1 day. */
async function fetchConceptSeries(
  taxonomy: string,
  tag: string,
  unit: string
): Promise<EdgarUnitDatum[]> {
  try {
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${NOW_CIK}/${taxonomy}/${tag}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": EDGAR_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CompanyConceptResponse;
    const series = json.units?.[unit];
    return Array.isArray(series) ? series.filter((d) => d.end && typeof d.val === "number") : [];
  } catch {
    return [];
  }
}

/** us-gaap USD instant series (cash, debt, etc.). */
async function fetchInstantSeries(tag: string): Promise<EdgarUnitDatum[]> {
  return fetchConceptSeries("us-gaap", tag, "USD");
}

/** Compute NOW's net cash from EDGAR. Returns null if the cash figure can't be fetched. */
export async function fetchNetCash(): Promise<NetCashResult | null> {
  const [cashAndInv, debt] = await Promise.all([
    Promise.all(NETCASH_CASH_TAGS.map(fetchInstantSeries)),
    Promise.all(NETCASH_DEBT_TAGS.map(fetchInstantSeries)),
  ]);

  const cashSeries = cashAndInv[0]; // CashAndCashEquivalents — the anchor
  if (!cashSeries.length) return null;
  const anchor = cashSeries.reduce((a, b) => (a.end > b.end ? a : b)).end;

  // Value of a series at the anchor date (exact match preferred; else latest point within ~100 days).
  const valueAt = (series: EdgarUnitDatum[]): number => {
    const exact = series.filter((d) => d.end === anchor);
    if (exact.length) return exact[exact.length - 1].val;
    const cutoff = Date.parse(anchor) - 100 * 86_400_000;
    const near = series.filter(
      (d) => Date.parse(d.end) <= Date.parse(anchor) && Date.parse(d.end) >= cutoff
    );
    return near.length ? near.reduce((a, b) => (a.end > b.end ? a : b)).val : 0;
  };

  const cashTotal = cashAndInv.reduce((sum, s) => sum + valueAt(s), 0);
  const debtTotal = debt.reduce((sum, s) => sum + valueAt(s), 0);
  return { netCash: (cashTotal - debtTotal) / 1e9, asOf: anchor };
}

/** us-gaap USD flow series (revenue, cash flow, capex). Empty on any error. Cached ~1 day. */
async function fetchFlowSeries(tag: string): Promise<EdgarUnitDatum[]> {
  return fetchConceptSeries("us-gaap", tag, "USD");
}

const DAY = 86_400_000;
const dayLen = (d: EdgarUnitDatum): number | null => periodDays(d.start, d.end);

/** Unique points by (start,end); EDGAR repeats the same period under multiple fiscal years. */
function dedupePeriods(series: EdgarUnitDatum[]): EdgarUnitDatum[] {
  const seen = new Set<string>();
  const out: EdgarUnitDatum[] = [];
  for (const d of series) {
    const key = `${d.start ?? ""}_${d.end}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(d);
    }
  }
  return out;
}

/** Annual (≈365-day) points, newest first. */
function annualPoints(series: EdgarUnitDatum[]): EdgarUnitDatum[] {
  return dedupePeriods(series)
    .filter((d) => {
      const n = dayLen(d);
      return n != null && n >= 350 && n <= 380;
    })
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
}

/**
 * Trailing-twelve-month total for a flow concept, robust to EDGAR's mixed reporting (CLAUDE.md:
 * "cash-flow figures are especially prone to YTD accumulation"):
 *  - if four discrete ~quarterly points span ~one year, sum them (income-statement style — revenue);
 *  - otherwise reconstruct from cumulatives: latest full year + current-year YTD − prior-year YTD
 *    (the standard fix for YTD-only cash flow / capex). Returns null if it can't be built.
 */
function ttmFlow(raw: EdgarUnitDatum[]): number | null {
  const series = dedupePeriods(raw);

  // 1) Four consecutive discrete quarters spanning ~one year (revenue files 3-month columns).
  const quarters = series
    .filter((d) => {
      const n = dayLen(d);
      return n != null && n >= 80 && n <= 100;
    })
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
  if (quarters.length >= 4) {
    const last4 = quarters.slice(0, 4);
    const span = periodDays(last4[3].start, last4[0].end);
    if (span != null && span >= 350 && span <= 380) {
      return last4.reduce((s, q) => s + q.val, 0);
    }
  }

  // 2) Cumulative reconstruction: full year + current-year YTD − prior-year YTD.
  const annuals = annualPoints(series);
  if (!annuals.length) return null;
  const fy = annuals[0];

  const interim = series
    .filter((d) => Date.parse(d.end) > Date.parse(fy.end))
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0];
  if (!interim) return fy.val; // latest full year is itself the freshest TTM

  const iLen = dayLen(interim);
  const targetPriorEnd = Date.parse(interim.end) - 365 * DAY;
  const prior = series
    .filter((d) => {
      const n = dayLen(d);
      return (
        n != null &&
        iLen != null &&
        Math.abs(n - iLen) <= 12 &&
        Math.abs(Date.parse(d.end) - targetPriorEnd) <= 25 * DAY
      );
    })
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.end) - targetPriorEnd) - Math.abs(Date.parse(b.end) - targetPriorEnd)
    )[0];
  if (!prior) return fy.val;
  return fy.val + interim.val - prior.val;
}

export interface FundamentalsResult {
  /** Trailing-twelve-month revenue, $B. */
  revenueTtm: number;
  /** Reported YoY revenue growth (decimal), latest full year vs. the prior one. Null if unavailable. */
  revenueGrowthYoY: number | null;
  /** Free-cash-flow margin (decimal) = (OCF − capex) over TTM ÷ TTM revenue. Null if unavailable. */
  fcfMargin: number | null;
  /** Most recent revenue period end (ISO YYYY-MM-DD) — the freshness anchor. */
  asOf: string;
}

/**
 * Compute NOW's core fundamentals live from EDGAR: TTM revenue, reported YoY growth, and FCF margin.
 *
 * Returns null only if revenue (the anchor) can't be built; margin and growth degrade to null
 * independently so a missing capex tag or single annual point doesn't sink the whole result.
 */
export async function fetchFundamentals(): Promise<FundamentalsResult | null> {
  const [revRaw, ocfRaw, capexRaw] = await Promise.all([
    fetchFlowSeries(EDGAR_TAGS.revenue),
    fetchFlowSeries(EDGAR_TAGS.operatingCashFlow),
    fetchFlowSeries(EDGAR_TAGS.capex),
  ]);

  const revenueTtmUsd = ttmFlow(revRaw);
  if (revenueTtmUsd == null) return null;

  // Reported YoY growth from the two latest full fiscal years (e.g. FY25 vs FY24).
  const revAnnuals = annualPoints(revRaw);
  const revenueGrowthYoY =
    revAnnuals.length >= 2 && revAnnuals[1].val > 0
      ? revAnnuals[0].val / revAnnuals[1].val - 1
      : null;

  const ocfTtm = ttmFlow(ocfRaw);
  const capexTtm = ttmFlow(capexRaw);
  const fcfMargin =
    ocfTtm != null && capexTtm != null && revenueTtmUsd > 0
      ? (ocfTtm - capexTtm) / revenueTtmUsd
      : null;

  const asOf =
    dedupePeriods(revRaw)
      .map((d) => d.end)
      .sort()
      .reverse()[0] ?? "latest filing";

  return {
    revenueTtm: revenueTtmUsd / 1e9,
    revenueGrowthYoY,
    fcfMargin,
    asOf,
  };
}

export interface SharesResult {
  /** Shares outstanding in billions (latest reported — post-split). */
  shares: number;
  /** Date the figure is as-of (ISO YYYY-MM-DD). */
  asOf: string;
}

/**
 * NOW's shares outstanding from EDGAR — cover-page count (dei) preferred, balance-sheet count as
 * fallback. Takes the LATEST reported figure, which is post-split (~1.03B); older points are
 * pre-split (~0.21B) and must NEVER be used (CLAUDE.md stock-split rule). Returns null on failure.
 */
export async function fetchSharesOutstanding(): Promise<SharesResult | null> {
  let series = await fetchConceptSeries("dei", "EntityCommonStockSharesOutstanding", "shares");
  if (!series.length) {
    series = await fetchConceptSeries("us-gaap", "CommonStockSharesOutstanding", "shares");
  }
  if (!series.length) return null;
  const latest = series.reduce((a, b) => (a.end > b.end ? a : b));
  return { shares: latest.val / 1e9, asOf: latest.end };
}
