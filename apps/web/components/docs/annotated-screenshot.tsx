import type { ReactNode } from "react";

export type Callout = {
  /** Point the arrow touches, in the screenshot's pixel coordinates. */
  target: [number, number];
  /** Where the numbered marker sits, in pixel coordinates. The arrow runs marker → target. */
  marker: [number, number];
  /** Explanation shown in the numbered list under the image. */
  text: ReactNode;
};

/**
 * A real screenshot with numbered markers and arrows pointing at the parts being explained,
 * followed by the matching numbered explanations. Coordinates are in the image's own pixels, so
 * the overlay scales with the image at every width.
 */
export function AnnotatedScreenshot({
  src,
  width,
  height,
  alt,
  callouts,
  caption,
  maxWidth,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  callouts: Callout[];
  caption?: ReactNode;
  /** Display cap for small (e.g. ticket) screenshots, in CSS pixels. */
  maxWidth?: number;
}) {
  const radius = width >= 1000 ? 20 : 13;
  const arrowId = `arrow-${src.replace(/[^a-z0-9]/gi, "-")}`;
  const font = radius * 1.05;
  const stroke = width >= 1000 ? 3 : 2;
  return (
    <figure className="not-prose my-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_16px_40px_-28px_rgba(11,16,32,0.3)]" style={maxWidth ? { maxWidth } : undefined}>
        <a href={src} target="_blank" rel="noreferrer" className="relative block" aria-label={`${alt} (open full size)`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot with known dimensions */}
          <img src={src} width={width} height={height} alt={alt} className="block h-auto w-full" loading="lazy" />
          <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#3d3bff" />
              </marker>
            </defs>
            {callouts.map((callout, index) => {
              const [tx, ty] = callout.target;
              const [mx, my] = callout.marker;
              const dx = tx - mx;
              const dy = ty - my;
              const length = Math.hypot(dx, dy) || 1;
              // Start the line at the marker's edge so it doesn't cross the number.
              const sx = mx + (dx / length) * radius;
              const sy = my + (dy / length) * radius;
              return (
                <g key={index}>
                  {length > radius * 1.5 ? (
                    <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="#3d3bff" strokeWidth={stroke} markerEnd={`url(#${arrowId})`} />
                  ) : null}
                  <circle cx={mx} cy={my} r={radius} fill="#3d3bff" stroke="#ffffff" strokeWidth={stroke} />
                  <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={font} fontWeight={700} fill="#ffffff" fontFamily="var(--font-mona), sans-serif">
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </a>
      </div>
      {caption ? <figcaption className="mt-2 text-xs text-subtle">{caption}</figcaption> : null}
      <ol className="mt-5 space-y-3">
        {callouts.map((callout, index) => (
          <li key={index} className="flex gap-3 text-sm text-muted">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-signal text-xs font-bold text-signal-foreground" aria-hidden="true">
              {index + 1}
            </span>
            <span className="pt-0.5">
              <span className="sr-only">{index + 1}. </span>
              {callout.text}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
