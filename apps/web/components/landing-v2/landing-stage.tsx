"use client";

import { createContext, useContext, type ReactNode } from "react";
import { fontByKey, fontVars } from "./font-options";

export type CoinColors = { a: string; aUp: string; aDown: string; b: string; bUp: string; bDown: string };

/** A cobalt coin (white ∧, ink ∨) and an ink coin (light-cobalt ∧, white ∨), matching the app icons. */
const COBALT_COINS: CoinColors = { a: "#3d3bff", aUp: "#ffffff", aDown: "#0b1020", b: "#0b1020", bUp: "#9b9aff", bDown: "#ffffff" };

const CoinColorsContext = createContext<CoinColors>(COBALT_COINS);
export const useCoinColors = () => useContext(CoinColorsContext);

/** Landing page wrapper: display-type sizing for Mona Sans and the brand coin colours. */
export function LandingStage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <CoinColorsContext.Provider value={COBALT_COINS}>
      <div className={className} style={fontVars(fontByKey("mona"))}>
        {children}
      </div>
    </CoinColorsContext.Provider>
  );
}
