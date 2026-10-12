import type { Metadata, Viewport } from "next";
import { WalletProviders } from "@/components/wallet-providers";
import { geistMono, mona } from "@/lib/fonts";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Moxie — Trade what happens next", template: "%s · Moxie" },
  description: "Leveraged prediction markets, cleared on Solana.",
};

export const viewport: Viewport = {
  themeColor: "#f6f7fb",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mona.variable} ${geistMono.variable}`}>
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
