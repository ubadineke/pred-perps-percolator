import type { CSSProperties } from "react";

export type FontOption = {
  key: string;
  label: string;
  vibe: string;
  family: string;
  weight: number;
  uppercase: boolean;
  /** font-variation-settings for width/optical axes. */
  variation?: string;
  stretch?: string;
  tracking: string;
  leading: number;
  /** Size multiplier so every font fills roughly the same width. */
  scale: number;
};

export const FONT_OPTIONS: FontOption[] = [
  { key: "mona", label: "Mona Sans", vibe: "Modern product. Clean, premium, friendly.", family: "var(--font-mona)", weight: 800, uppercase: false, variation: "'wdth' 100", tracking: "-0.05em", leading: 0.9, scale: 0.72 },
];

export const DEFAULT_FONT = FONT_OPTIONS[0]!;

export const fontByKey = (key?: string | null) => FONT_OPTIONS.find((f) => f.key === key) ?? DEFAULT_FONT;

/** CSS variables consumed by `.font-display-condensed` and the size calculations. */
export function fontVars(option: FontOption): CSSProperties {
  return {
    "--d-family": `${option.family}, "Arial Narrow", sans-serif`,
    "--d-weight": String(option.weight),
    "--d-transform": option.uppercase ? "uppercase" : "none",
    "--d-variation": option.variation ?? "normal",
    "--d-stretch": option.stretch ?? "100%",
    "--d-tracking": option.tracking,
    "--d-leading": String(option.leading),
    "--d-scale": String(option.scale),
  } as CSSProperties;
}
