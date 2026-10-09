import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProviders } from "@/components/wallet-providers";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Moxie — Trade the probability", template: "%s · Moxie" },
  description: "Leveraged prediction markets, cleared on Solana.",
};

export const viewport: Viewport = {
  themeColor: "#080a0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
