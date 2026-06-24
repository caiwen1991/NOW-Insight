import { describe, it, expect } from "vitest";
import { runDcf, solveImpliedGrowth, HORIZON, type DcfInputs, type DcfCompany } from "@/lib/dcf";

const company: DcfCompany = {
  ttmRevenue: 14,
  currentFcfMargin: 0.31,
  netCash: 7.9,
  sharesOutstanding: 1.03,
};

const inputs: DcfInputs = {
  year1Growth: 0.21,
  terminalGrowth: 0.03,
  terminalFcfMargin: 0.35,
  wacc: 0.09,
  perpetuityGrowth: 0.025,
};

describe("runDcf", () => {
  it("projects the full horizon", () => {
    expect(runDcf(inputs, company).perSharesByYear).toHaveLength(HORIZON);
  });

  it("applies year1Growth and currentFcfMargin in year 1", () => {
    const y1 = runDcf(inputs, company).perSharesByYear[0];
    expect(y1.growth).toBeCloseTo(inputs.year1Growth, 10);
    expect(y1.revenue).toBeCloseTo(company.ttmRevenue * (1 + inputs.year1Growth), 6);
    expect(y1.fcfMargin).toBeCloseTo(company.currentFcfMargin, 10);
  });

  it("adds net cash to enterprise value to get equity value, then divides by shares", () => {
    const r = runDcf(inputs, company);
    expect(r.equityValue).toBeCloseTo(r.enterpriseValue + company.netCash, 6);
    expect(r.fairValuePerShare).toBeCloseTo(r.equityValue / company.sharesOutstanding, 6);
  });

  it("produces a finite, positive fair value for sane inputs", () => {
    const r = runDcf(inputs, company);
    expect(Number.isFinite(r.fairValuePerShare)).toBe(true);
    expect(r.fairValuePerShare).toBeGreaterThan(0);
  });

  it("returns NaN when WACC does not exceed the perpetuity growth rate", () => {
    const bad = runDcf({ ...inputs, wacc: 0.02, perpetuityGrowth: 0.03 }, company);
    expect(Number.isNaN(bad.fairValuePerShare)).toBe(true);
  });

  it("is monotonic: higher year-1 growth implies a higher fair value", () => {
    const lo = runDcf({ ...inputs, year1Growth: 0.1 }, company).fairValuePerShare;
    const hi = runDcf({ ...inputs, year1Growth: 0.3 }, company).fairValuePerShare;
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("solveImpliedGrowth", () => {
  it("recovers the year-1 growth that reproduces a given price", () => {
    const target = runDcf({ ...inputs, year1Growth: 0.18 }, company).fairValuePerShare;
    const g = solveImpliedGrowth(target, inputs, company);
    expect(g).not.toBeNull();
    const reproduced = runDcf({ ...inputs, year1Growth: g! }, company).fairValuePerShare;
    expect(reproduced).toBeCloseTo(target, 1);
  });

  it("returns null when the target price is unreachable", () => {
    expect(solveImpliedGrowth(1e9, inputs, company)).toBeNull();
  });
});
