/** Small display formatters shared across the UI. */

/** 0.214 -> "21.4%". */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 104.27 -> "$104.27". */
export function formatUsd(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 14 -> "$14.0B" (input already in billions). */
export function formatUsdBillions(valueInB: number, digits = 1): string {
  return `$${valueInB.toFixed(digits)}B`;
}
