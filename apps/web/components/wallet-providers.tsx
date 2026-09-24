"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useWallets as usePrivySolanaWallets } from "@privy-io/react-auth/solana";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

type PrivyWalletState = {
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  login: () => void;
  logout: () => Promise<void>;
};

const disabledPrivyState: PrivyWalletState = {
  enabled: false,
  ready: true,
  authenticated: false,
  address: null,
  login: () => undefined,
  logout: async () => undefined,
};

const PrivyWalletContext = createContext<PrivyWalletState>(disabledPrivyState);

function PrivyWalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = usePrivySolanaWallets();

  return (
    <PrivyWalletContext.Provider
      value={{
        enabled: true,
        ready,
        authenticated,
        address: wallets[0]?.address ?? null,
        login: () => login({ loginMethods: ["email", "google"] }),
        logout,
      }}
    >
      {children}
    </PrivyWalletContext.Provider>
  );
}

export function usePrivyWalletState() {
  return useContext(PrivyWalletContext);
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();

  const walletStandardLayer = (
    <ConnectionProvider endpoint={endpoint}>
      {/* An empty adapter list intentionally enables Wallet Standard discovery. */}
      <WalletProvider wallets={[]} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );

  if (!privyAppId) return walletStandardLayer;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#c7ff4a",
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "all-users" },
        },
      }}
    >
      <PrivyWalletBridge>{walletStandardLayer}</PrivyWalletBridge>
    </PrivyProvider>
  );
}
