import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moxie — Trade the probability",
  description: "Leveraged prediction markets, cleared on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
