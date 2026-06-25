/** Display formatters for the landing page (whole-dollar prices, multiples, $B, signed %). */

/** 93.89 -> "$94" (whole dollars, used for big model prices and chart bars). */
export function usd0(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** 93.89 -> "$93.89" (cents, used for the live quote). */
export function usd2(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 98.9 -> "$98.9B" (input already in billions). */
export function usdB(valueInB: number, digits = 1): string {
  return `$${valueInB.toFixed(digits)}B`;
}

/** 0.214 -> "21%" (or with one decimal). */
export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** -0.0214 -> "−2.14%" with a real minus sign and explicit sign. */
export function signedPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${(Math.abs(value) * 100).toFixed(digits)}%`;
}

/** 7.12 -> "7.1×". */
export function mult(value: number, digits = 1): string {
  return `${value.toFixed(digits)}×`;
}

/** A small directional glyph for up/down deltas (matches the design's ▲/▼). */
export function arrow(value: number): string {
  return value > 0 ? "▲" : value < 0 ? "▼" : "■";
}
