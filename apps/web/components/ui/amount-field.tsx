"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Labelled numeric input with a unit suffix and optional quick presets.
 * The value is a string so partially typed numbers ("1.", "") survive re-renders.
 */
export function AmountField({
  label,
  value,
  onChange,
  unit,
  presets,
  hint,
  error,
  max,
  disabled,
  labelAside,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  presets?: readonly { label: string; value: string }[];
  hint?: ReactNode;
  error?: ReactNode;
  max?: number;
  disabled?: boolean;
  labelAside?: ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
        {labelAside ? <span className="text-xs text-subtle">{labelAside}</span> : null}
      </div>
      <div
        className={cn(
          "flex h-11 items-center rounded-md border bg-surface px-3 transition-colors focus-within:border-signal",
          error ? "border-short/60" : "border-border-strong",
          disabled && "opacity-50",
        )}
      >
        <input
          id={id}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          min={0}
          max={max}
          step="any"
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground outline-none placeholder:text-subtle focus-visible:outline-none"
          placeholder="0.00"
        />
        <span className="ml-2 text-xs font-medium text-subtle">{unit}</span>
      </div>
      {presets?.length ? (
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` }}>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className="h-8 rounded-md border border-border text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-45"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-short">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
