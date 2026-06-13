"use client";

export default function Sparkline({
  data,
  positive,
  width = 56,
  height = 18,
}: {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "#39ff14" : "#ff4d4d";
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1} opacity={0.9} />
    </svg>
  );
}
