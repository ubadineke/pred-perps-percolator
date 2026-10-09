"use client";

import { useMemo, useState } from "react";

/** Interactive explainer: how order flow moves the Moxie price while the mark and index stay anchored. */
export function PriceFormation() {
  const [pressure, setPressure] = useState(30);
  const values = useMemo(() => {
    const index = 45;
    const moxie = index + pressure * 0.2;
    const mark = index * 0.7 + moxie * 0.3;
    return { index, moxie, mark };
  }, [pressure]);

  const pins = [
    { label: "Source index", value: values.index, className: "bg-subtle", text: "text-muted" },
    { label: "Protected mark", value: values.mark, className: "bg-warning", text: "text-warning" },
    { label: "Moxie price", value: values.moxie, className: "bg-signal", text: "text-signal" },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-8">
      <div className="flex justify-between text-xs font-medium text-subtle">
        <span>0¢ · No</span>
        <span>Yes · 100¢</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-signal/20 transition-[width] duration-200" style={{ width: `${values.moxie}%` }} />
        {pins.map((pin) => (
          <span key={pin.label} className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-surface transition-[left] duration-200 ${pin.className}`} style={{ left: `${pin.value}%` }} aria-hidden="true" />
        ))}
      </div>
      <dl className="mt-8 grid grid-cols-3 gap-4">
        {pins.map((pin) => (
          <div key={pin.label}>
            <dt className="text-xs text-subtle">{pin.label}</dt>
            <dd className={`mt-1 font-mono text-xl font-medium ${pin.text}`}>{pin.value.toFixed(1)}¢</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 border-t border-border pt-6">
        <label htmlFor="pressure" className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-foreground">Simulate order flow</span>
          <span className="font-mono text-xs text-muted">{pressure > 0 ? `${pressure}% net long` : pressure < 0 ? `${-pressure}% net short` : "Balanced"}</span>
        </label>
        <input id="pressure" className="range-input mt-4" type="range" min={-45} max={45} value={pressure} onChange={(event) => setPressure(Number(event.target.value))} />
        <div className="mt-2 flex justify-between text-xs text-subtle">
          <span>Short pressure</span>
          <span>Long pressure</span>
        </div>
      </div>
    </div>
  );
}
