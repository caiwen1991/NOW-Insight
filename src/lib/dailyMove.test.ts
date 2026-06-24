import { describe, it, expect } from "vitest";
import { decomposeMove } from "@/lib/dailyMove";

describe("decomposeMove", () => {
  it("splits the move into parts that sum back to NOW's total", () => {
    const d = decomposeMove({ nowPct: -0.021, marketPct: -0.011, sectorPct: 0.004 });
    expect(d.market + d.sectorSpecific + d.companySpecific).toBeCloseTo(d.total, 12);
    expect(d.total).toBeCloseTo(-0.021, 12);
  });

  it("computes each component from the identity", () => {
    const d = decomposeMove({ nowPct: -0.021, marketPct: -0.011, sectorPct: 0.004 });
    expect(d.market).toBeCloseTo(-0.011, 12); // = market proxy
    expect(d.sectorSpecific).toBeCloseTo(0.015, 12); // sector − market
    expect(d.companySpecific).toBeCloseTo(-0.025, 12); // now − sector
  });

  it("classifies a near-zero move as flat", () => {
    expect(decomposeMove({ nowPct: 0.0005, marketPct: 0.0004, sectorPct: 0.0003 }).classification).toBe(
      "flat"
    );
  });

  it("classifies a move that tracks its sector as mostly-macro", () => {
    const d = decomposeMove({ nowPct: 0.02, marketPct: 0.01, sectorPct: 0.02 });
    expect(d.companySpecific).toBeCloseTo(0, 12);
    expect(d.classification).toBe("mostly-macro");
  });

  it("classifies a company-driven move as mostly-company", () => {
    const d = decomposeMove({ nowPct: 0.05, marketPct: 0, sectorPct: 0 });
    expect(d.classification).toBe("mostly-company");
    expect(d.companyShare).toBeCloseTo(1, 12);
  });

  it("companyShare and macroShare sum to 1 for a non-flat move", () => {
    const d = decomposeMove({ nowPct: 0.03, marketPct: 0.01, sectorPct: 0.02 });
    expect(d.companyShare + d.macroShare).toBeCloseTo(1, 12);
  });
});
