import { Geist_Mono, Mona_Sans } from "next/font/google";

/** Brand typeface for interface and display text. Width-variable, so headlines can condense. */
export const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });

/** Numbers only: prices, sizes, balances. */
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
