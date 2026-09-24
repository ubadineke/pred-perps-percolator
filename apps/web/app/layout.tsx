import type { Metadata } from "next";
import { WalletProviders } from "../components/wallet-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moxie — Trade the probability",
  description: "Leveraged prediction markets, cleared on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body><WalletProviders>{children}</WalletProviders></body>
    </html>
  );
}
