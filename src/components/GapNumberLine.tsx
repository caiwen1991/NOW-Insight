import { formatUsd } from "@/lib/format";

/**
 * The gap "number line": plots a price and an implied fair value on one axis, with the gap shaded
 * between them, a NEUTRAL "X% below/above implied" chip, and a value label under each marker.
 *
 * Caller guarantees `price` and `fair` are finite, positive numbers and wraps this in its own card.
 * Teal identifies the implied-value series only; the chip is neutral (no good/bad coloring).
 */
export function GapNumberLine({
  price,
  fair,
  label,
  priceCaption = "Price (delayed)",
  impliedCaption = "Implied fair value",
}: {
  price: number;
  fair: number;
  label: string;
  priceCaption?: string;
  impliedCaption?: string;
}) {
  const pct = Math.round(Math.abs((price - fair) / fair) * 100);
  const inLine = pct < 5;
  const dir = price < fair ? "below" : "above";
  const chip = inLine ? "≈ in line with implied" : `~${pct}% ${dir} implied`;

  // Map both values onto one axis with value-proportional padding, clamped so markers/labels never
  // collide with the card edges. When the two are very close, nudge them apart for legibility.
  const lo = Math.min(price, fair) * 0.85;
  const hi = Math.max(price, fair) * 1.1;
  const rawPos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const clamp = (p: number) => Math.max(12, Math.min(88, p));
  let pricePos = clamp(rawPos(price));
  let impliedPos = clamp(rawPos(fair));
  if (Math.abs(pricePos - impliedPos) < 24) {
    const mid = (pricePos + impliedPos) / 2;
    pricePos = price < fair ? mid - 12 : mid + 12;
    impliedPos = price < fair ? mid + 12 : mid - 12;
  }
  const gapLeft = Math.min(pricePos, impliedPos);
  const gapRight = 100 - Math.max(pricePos, impliedPos);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        <span className="rounded-md bg-stone-soft px-2.5 py-1 text-sm font-medium text-ink">
          {chip}
        </span>
      </div>

      <div className="mx-1.5 mt-8">
        <div className="relative h-2">
          <div className="absolute inset-0 rounded-full bg-stone-soft" />
          <div
            className="absolute inset-y-0 rounded-full bg-teal-soft"
            style={{ left: `${gapLeft}%`, right: `${gapRight}%` }}
          />
          <Marker pos={pricePos} className="bg-ink" />
          <Marker pos={impliedPos} className="bg-teal" />
        </div>

        <div className="relative mt-3 h-11">
          <AxisLabel pos={pricePos} caption={priceCaption} value={formatUsd(price)} valueClass="text-ink" />
          <AxisLabel
            pos={impliedPos}
            caption={impliedCaption}
            value={formatUsd(fair)}
            valueClass="text-teal"
          />
        </div>
      </div>
    </div>
  );
}

function Marker({ pos, className }: { pos: number; className: string }) {
  return (
    <div
      className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white ${className}`}
      style={{ left: `${pos}%` }}
    />
  );
}

function AxisLabel({
  pos,
  caption,
  value,
  valueClass,
}: {
  pos: number;
  caption: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div
      className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center"
      style={{ left: `${pos}%` }}
    >
      <div className="text-[11px] text-muted">{caption}</div>
      <div className={`text-lg font-medium tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
