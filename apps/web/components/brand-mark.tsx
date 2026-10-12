import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const COBALT = "#3d3bff";
const INK = "#0b1020";
const LIGHT_COBALT = "#9b9aff";

/**
 * The Moxie mark: an "x" made of a cobalt ∧ (up, long) below an ink ∨ (down, short),
 * meeting in the middle. `up` and `down` set the two colours.
 */
export function MoxieMark({ size = 24, up = COBALT, down = INK, weight = 15, className, style }: { size?: number; up?: string; down?: string; /** Stroke width in a 100-unit box; heavier for small sizes. */ weight?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16 L50 44 L84 16" stroke={down} strokeWidth={weight} />
      <path d="M16 84 L50 56 L84 84" stroke={up} strokeWidth={weight} />
    </svg>
  );
}

/**
 * The Moxie wordmark: "moxie" in heavy Mona Sans, with the mark as its x.
 * `size` is the font size in px. `tone="dark"` is for use on dark backgrounds.
 */
export function BrandMark({ size = 22, tone = "light", compact = false, className }: { size?: number; tone?: "light" | "dark"; compact?: boolean; className?: string }) {
  const text = tone === "dark" ? "#ffffff" : INK;
  const up = tone === "dark" ? LIGHT_COBALT : COBALT;
  if (compact)
    return (
      <span className={cn("inline-flex", className)}>
        <MoxieMark size={size * 1.1} weight={18} up={up} down={text} />
        <span className="sr-only">Moxie</span>
      </span>
    );
  return (
    <span
      className={cn("inline-flex items-baseline whitespace-nowrap", className)}
      style={{ color: text, fontSize: size, fontFamily: "var(--font-mona), sans-serif", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}
    >
      <span aria-hidden="true">mo</span>
      <MoxieMark size={size * 0.68} weight={21} up={up} down={text} style={{ display: "inline-block", alignSelf: "baseline", transform: "translateY(0.06em)", margin: "0 0.03em 0 0.05em" }} />
      <span aria-hidden="true">ie</span>
      <span className="sr-only">Moxie</span>
    </span>
  );
}
