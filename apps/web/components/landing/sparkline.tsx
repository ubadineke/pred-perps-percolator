import type { ApiChartPoint } from "@/lib/api";

/** Static SVG sparkline of mark history (server-rendered). Flat or empty data draws a centred line. */
export function Sparkline({ points, className }: { points: ApiChartPoint[]; className?: string }) {
  const width = 400;
  const height = 120;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 2); // at least 2¢ so tiny moves don't look dramatic
  const mid = (min + max) / 2;
  const y = (v: number) => height / 2 - ((v - mid) / span) * (height - 24);
  const path =
    points.length > 1
      ? points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * width).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")
      : `M0 ${height / 2} L${width} ${height / 2}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${width} ${height} L0 ${height} Z`} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="var(--color-signal)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
