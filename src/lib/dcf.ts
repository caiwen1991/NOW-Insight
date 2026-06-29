/**
 * Reverse-DCF engine for NOW Insight.
 *
 * This module is PURE — no React, no I/O — so it can be unit-tested and reused on
 * server or client. It preserves the engine logic from CLAUDE.md exactly.
 *
 * UNITS (read this before touching the math):
 *  - All monetary values are in **billions of USD** ($B): revenue, FCF, net cash, EV, equity.
 *  - `sharesOutstanding` is in **billions of shares**.
 *  - Therefore equity ($B) / shares (B) = fair value per share in plain USD.
 *
 * STOCK-SPLIT RULE (CLAUDE.md, critical):
 *  The engine works entirely in market-cap / enterprise-value terms, which are split-invariant.
 *  It converts to a per-share figure only at the very END, using the CURRENT post-split share
 *  count (~1.03B). Never feed pre-split share counts in here.
 */

/** The five user-adjustable slider inputs. All rates are decimals (0.20 = 20%). */
export interface DcfInputs {
  /** Year-1 revenue growth rate (decimal). Fades linearly to `terminalGrowth` by year 10. */
  year1Growth: number;
  /** Terminal revenue growth rate reached at year 10 (decimal). */
  terminalGrowth: number;
  /** FCF margin assumption, held CONSTANT across all 10 years (decimal). */
  terminalFcfMargin: number;
  /** Weighted average cost of capital / discount rate (decimal). Must exceed `perpetuityGrowth`. */
  wacc: number;
  /** Perpetuity (Gordon) growth rate used for terminal value (decimal). */
  perpetuityGrowth: number;
}

/** Company facts that are NOT user-adjustable — sourced from public filings (see lib/company.ts). */
export interface DcfCompany {
  /** Trailing-twelve-month revenue base, in $B. */
  ttmRevenue: number;
  /** Current FCF margin (decimal). Reference only — kept for seeding presets; the projection now
   * holds margin flat at the `terminalFcfMargin` assumption rather than ramping from this. */
  currentFcfMargin: number;
  /** Net cash position in $B (cash minus debt). NOW is net cash, so this ADDS to equity value. */
  netCash: number;
  /** Current post-split shares outstanding, in billions. */
  sharesOutstanding: number;
}

/** Projection horizon in years (CLAUDE.md: 10-year horizon). */
export const HORIZON: number = 10;

export interface ProjectionYear {
  year: number; // 1..HORIZON
  growth: number; // revenue growth applied this year (decimal)
  revenue: number; // $B
  fcfMargin: number; // decimal
  fcf: number; // $B
  discountFactor: number; // 1 / (1+wacc)^year
  pvFcf: number; // $B
}

export interface DcfResult {
  perSharesByYear: ProjectionYear[];
  /** PV of the explicit-period free cash flows, $B. */
  pvExplicit: number;
  /** Undiscounted terminal value at year 10, $B. */
  terminalValue: number;
  /** PV of the terminal value, $B. */
  pvTerminal: number;
  /** Enterprise value = PV(explicit FCF) + PV(terminal value), $B. */
  enterpriseValue: number;
  /** Equity value = EV + net cash, $B. */
  equityValue: number;
  /** Implied fair value per share, in USD. NaN if inputs are degenerate. */
  fairValuePerShare: number;
}

/** Linear interpolation from `a` (at year 1) to `b` (at year `HORIZON`). */
function lerpOverHorizon(a: number, b: number, year: number): number {
  if (HORIZON === 1) return b;
  return a + (b - a) * ((year - 1) / (HORIZON - 1));
}

/**
 * Run the reverse DCF.
 *
 * Year-by-year:
 *  - growth fades linearly from `year1Growth` (year 1) to `terminalGrowth` (year 10)
 *  - FCF margin is held CONSTANT at `terminalFcfMargin` for every year (a flat assumption)
 *  - revenue compounds; FCF = revenue × margin; discount at WACC
 * Terminal value uses Gordon growth on the last year's FCF, then is discounted back.
 */
export function runDcf(inputs: DcfInputs, company: DcfCompany): DcfResult {
  const { year1Growth, terminalGrowth, terminalFcfMargin, wacc, perpetuityGrowth } = inputs;
  const { ttmRevenue, netCash, sharesOutstanding } = company;

  const years: ProjectionYear[] = [];
  let revenue = ttmRevenue;
  let lastFcf = 0;
  let pvExplicit = 0;

  for (let year = 1; year <= HORIZON; year++) {
    const growth = lerpOverHorizon(year1Growth, terminalGrowth, year);
    revenue = revenue * (1 + growth);
    const fcfMargin = terminalFcfMargin; // held flat across the horizon
    const fcf = revenue * fcfMargin;
    const discountFactor = 1 / Math.pow(1 + wacc, year);
    const pvFcf = fcf * discountFactor;

    pvExplicit += pvFcf;
    lastFcf = fcf;
    years.push({ year, growth, revenue, fcfMargin, fcf, discountFactor, pvFcf });
  }

  // Gordon-growth terminal value on the final-year FCF. Guard against wacc <= perpetuity,
  // which would make the denominator zero or negative (a nonsensical/infinite valuation).
  const spread = wacc - perpetuityGrowth;
  const terminalValue = spread > 0 ? (lastFcf * (1 + perpetuityGrowth)) / spread : NaN;
  const pvTerminal = terminalValue / Math.pow(1 + wacc, HORIZON);

  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue + netCash; // net cash ADDS (NOW is net cash)
  const fairValuePerShare = equityValue / sharesOutstanding;

  return {
    perSharesByYear: years,
    pvExplicit,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
    fairValuePerShare,
  };
}

/**
 * "Solve for implied growth": find the Year-1 revenue growth that makes the implied fair value
 * equal the current market price. Fair value is monotonically increasing in `year1Growth`, so a
 * binary search converges. Returns the growth rate (decimal), or null if it can't bracket a root
 * within the search range (e.g. the price is unreachable for any plausible growth).
 */
export function solveImpliedGrowth(
  targetPrice: number,
  inputs: DcfInputs,
  company: DcfCompany,
  opts: { low?: number; high?: number; tolerance?: number; maxIterations?: number } = {}
): number | null {
  const low0 = opts.low ?? -0.5; // -50% revenue decline per year
  const high0 = opts.high ?? 1.5; // +150% — generously wide
  const tolerance = opts.tolerance ?? 0.01; // converge to within $0.01/share
  const maxIterations = opts.maxIterations ?? 100;

  const fairAt = (g: number) => runDcf({ ...inputs, year1Growth: g }, company).fairValuePerShare;

  let low = low0;
  let high = high0;
  const fLow = fairAt(low) - targetPrice;
  const fHigh = fairAt(high) - targetPrice;

  // The target price must lie between the values produced at the search bounds.
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow > 0 || fHigh < 0) {
    return null;
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const fMid = fairAt(mid) - targetPrice;
    if (Math.abs(fMid) < tolerance) return mid;
    if (fMid < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * "Solve for the implied discount rate": find the WACC that makes implied fair value equal the
 * current market price, holding the other four assumptions fixed. Fair value is monotonically
 * DECREASING in WACC (a higher discount rate lowers every present value), so the search direction is
 * the mirror image of solveImpliedGrowth. The lower bound stays just above the perpetuity growth so
 * the terminal value denominator (WACC − perpetuity) is positive. Returns null if the price can't be
 * bracketed within the search range.
 */
export function solveImpliedWacc(
  targetPrice: number,
  inputs: DcfInputs,
  company: DcfCompany,
  opts: { low?: number; high?: number; tolerance?: number; maxIterations?: number } = {}
): number | null {
  const low0 = opts.low ?? inputs.perpetuityGrowth + 0.001; // must exceed perpetuity growth
  const high0 = opts.high ?? 0.5; // 50% — generously wide
  const tolerance = opts.tolerance ?? 0.01;
  const maxIterations = opts.maxIterations ?? 100;

  const fairAt = (w: number) => runDcf({ ...inputs, wacc: w }, company).fairValuePerShare;

  let low = low0; // low WACC → high fair value
  let high = high0; // high WACC → low fair value
  const fLow = fairAt(low) - targetPrice;
  const fHigh = fairAt(high) - targetPrice;

  // Price must sit between the values at the bounds: high at low WACC, low at high WACC.
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow < 0 || fHigh > 0) {
    return null;
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const fMid = fairAt(mid) - targetPrice;
    if (Math.abs(fMid) < tolerance) return mid;
    if (fMid > 0) low = mid; // fair still above price → raise the discount rate
    else high = mid;
  }
  return (low + high) / 2;
}
