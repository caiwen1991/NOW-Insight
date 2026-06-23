/**
 * Daily-move decomposition for NOW Insight.
 *
 * Pure module — no React, no I/O — so it can be unit-tested and reused on server or client.
 *
 * Splits NOW's daily % move into three additive parts using a software-sector proxy (IGV) and a
 * broad-market proxy (SPY). The split is an exact identity (assuming beta ≈ 1, the Phase-1
 * simplification — see CLAUDE.md):
 *
 *   NOW%  =  market  +  sectorSpecific  +  companySpecific
 *         =  SPY%    +  (IGV% − SPY%)   +  (NOW% − IGV%)
 *
 * All percentages are DECIMALS (e.g. -0.021 = −2.1%).
 */

export interface MoveInputs {
  /** NOW daily % change (decimal). */
  nowPct: number;
  /** Market proxy (SPY) daily % change (decimal). */
  marketPct: number;
  /** Software-sector proxy (IGV) daily % change (decimal). */
  sectorPct: number;
}

export type MoveClassification = "flat" | "mostly-macro" | "mixed" | "mostly-company";

export interface MoveDecomposition {
  /** Broad-market contribution = marketPct. */
  market: number;
  /** Sector-specific contribution = sectorPct − marketPct (software's move beyond the market). */
  sectorSpecific: number;
  /** Company-specific residual = nowPct − sectorPct (NOW's move beyond its sector). */
  companySpecific: number;
  /** Total = nowPct (equals market + sectorSpecific + companySpecific by construction). */
  total: number;
  /** Share of the move's MAGNITUDE attributable to company-specific factors, in [0, 1]. */
  companyShare: number;
  /** Share of the move's magnitude attributable to market + sector (macro), in [0, 1]. */
  macroShare: number;
  classification: MoveClassification;
}

/** Below this magnitude (decimal) we treat a daily move as essentially flat. */
const FLAT_THRESHOLD = 0.001; // 0.1%

export function decomposeMove({ nowPct, marketPct, sectorPct }: MoveInputs): MoveDecomposition {
  const market = marketPct;
  const sectorSpecific = sectorPct - marketPct;
  const companySpecific = nowPct - sectorPct;
  const total = nowPct;

  // Magnitude-based shares are robust even when components offset each other (so a near-zero total
  // with large opposing pieces doesn't blow up). Macro magnitude = |market + sectorSpecific| = |sectorPct|.
  const macroMag = Math.abs(sectorPct);
  const companyMag = Math.abs(companySpecific);
  const denom = macroMag + companyMag;
  const companyShare = denom === 0 ? 0 : companyMag / denom;
  const macroShare = denom === 0 ? 0 : macroMag / denom;

  let classification: MoveClassification;
  if (Math.abs(total) < FLAT_THRESHOLD) {
    classification = "flat";
  } else if (companyShare < 0.34) {
    classification = "mostly-macro";
  } else if (companyShare <= 0.66) {
    classification = "mixed";
  } else {
    classification = "mostly-company";
  }

  return {
    market,
    sectorSpecific,
    companySpecific,
    total,
    companyShare,
    macroShare,
    classification,
  };
}
