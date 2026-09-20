"use client";

import { useMemo, useState } from "react";

export function PriceFormation() {
  const [pressure, setPressure] = useState(38);
  const values = useMemo(() => {
    const moxie = 45 + pressure * 0.085;
    const mark = 45 * 0.7 + Math.min(49, moxie) * 0.3;
    return { moxie, mark };
  }, [pressure]);

  return (
    <div className="formation-demo">
      <div className="formation-visual">
        <div className="axis-label no-label">0 · NO</div>
        <div className="axis-label yes-label">YES · 1</div>
        <div className="formation-track">
          <span className="index-pin" style={{ left: "45%" }}><i />INDEX 45.0</span>
          <span className="mark-pin" style={{ left: `${values.mark}%` }}><i />MARK {values.mark.toFixed(1)}</span>
          <span className="moxie-pin" style={{ left: `${values.moxie}%` }}><i />MOXIE {values.moxie.toFixed(1)}</span>
          <span className="pressure-fill" style={{ width: `${values.moxie}%` }} />
        </div>
      </div>
      <div className="formation-control">
        <div>
          <span className="eyebrow">SIMULATE ORDER FLOW</span>
          <strong>{pressure >= 0 ? `+${pressure}% long pressure` : `${pressure}% short pressure`}</strong>
        </div>
        <input
          aria-label="Long and short pressure"
          type="range"
          min="-45"
          max="45"
          value={pressure}
          onChange={(event) => setPressure(Number(event.target.value))}
        />
        <div className="range-labels"><span>SHORT</span><span>BALANCED</span><span>LONG</span></div>
      </div>
    </div>
  );
}
