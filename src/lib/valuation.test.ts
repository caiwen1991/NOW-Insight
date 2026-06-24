import { describe, it, expect } from "vitest";
import { computeMultiples, COMPANIES, type CompanyFundamentals } from "@/lib/valuation";

const sample: CompanyFundamentals = {
  symbol: "TEST",
  name: "Test Co",
  revenueTtm: 10,
  shares: 1,
  netCash: 5,
  revenueGrowth: 0.2,
  fcfMargin: 0.3,
  asOf: "test",
};

describe("computeMultiples", () => {
  it("derives enterprise value from market cap minus net cash", () => {
    const m = computeMultiples(100, sample);
    expect(m.marketCap).toBeCloseTo(100, 9); // 100 × 1
    expect(m.ev).toBeCloseTo(95, 9); // 100 − 5 net cash
  });

  it("computes EV/Revenue, EV/FCF and Rule of 40", () => {
    const m = computeMultiples(100, sample);
    expect(m.evRevenue).toBeCloseTo(9.5, 9); // 95 / 10
    expect(m.evFcf).toBeCloseTo(95 / (10 * 0.3), 9); // fcf = 3
    expect(m.ruleOf40).toBeCloseTo(50, 9); // (0.2 + 0.3) × 100
  });

  it("treats net cash as a reduction and net debt as an increase to EV", () => {
    expect(computeMultiples(100, { ...sample, netCash: -5 }).ev).toBeCloseTo(105, 9);
  });

  it("returns NaN EV/FCF when free cash flow is not positive", () => {
    expect(Number.isNaN(computeMultiples(100, { ...sample, fcfMargin: 0 }).evFcf)).toBe(true);
  });
});

describe("COMPANIES dataset", () => {
  it("lists NOW first", () => {
    expect(COMPANIES[0].symbol).toBe("NOW");
  });

  it("includes the chosen peers", () => {
    const symbols = COMPANIES.map((c) => c.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["NOW", "CRM", "WDAY", "ADBE", "DDOG"]));
  });
});
