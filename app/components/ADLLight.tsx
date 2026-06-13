"use client";

export default function ADLLight({
  side,
  size,
  entry,
  margin,
  mark,
}: {
  side: "long" | "short" | "flat";
  size: number;  // 1e6 units

  entry: number;  // 1e6

  margin: number;  // 1e6

  mark: number;  // 1e6
}) {
  if (side === "flat" || size === 0 || margin === 0) return <Bars lit={0} />;

  const upnl = side === "long" ? (mark - entry) * (size / 1e6) : (entry - mark) * (size / 1e6);
  if (upnl <= 0) return <Bars lit={0} />;

  const upnlPct = upnl / margin;

  const notional = (size * mark) / 1e6;
  const leverage = notional / margin;
  const score = upnlPct * leverage;

  const lit = score < 0.2 ? 1 : score < 0.5 ? 2 : score < 1 ? 3 : score < 2 ? 4 : 5;
  return <Bars lit={lit} />;
}

function Bars({ lit }: { lit: number }) {
  const colors = ["#39ff14", "#9bff39", "#ffd23f", "#ff8c39", "#ff4d4d"];
  return (
    <span className="inline-flex items-end gap-[2px] h-3" title={`ADL queue: ${lit}/5`} aria-label={`ADL risk ${lit} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm transition-colors"
          style={{
            height: `${5 + i * 1.6}px`,
            backgroundColor: i < lit ? colors[i] : "#26262b",
          }}
        />
      ))}
    </span>
  );
}
