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
  sendTransaction: ((transaction: Uint8Array) => Promise<string>) | null;
};

const disabledPrivyState: PrivyWalletState = {
  enabled: false,
  ready: true,
  authenticated: false,
  address: null,
  login: () => undefined,
  logout: async () => undefined,
  sendTransaction: null,
};

const base58=(bytes:Uint8Array)=>{const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";let n=0n;for(const byte of bytes)n=(n<<8n)|BigInt(byte);let out="";while(n){out=alphabet[Number(n%58n)]+out;n/=58n}for(const byte of bytes){if(byte!==0)break;out="1"+out}return out||"1"};

const PrivyWalletContext = createContext<PrivyWalletState>(disabledPrivyState);

function PrivyWalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = usePrivySolanaWallets();
  const wallet=wallets[0];

  return (
    <PrivyWalletContext.Provider
      value={{
        enabled: true,
        ready,
        authenticated,
        address: wallet?.address ?? null,
        login: () => login({ loginMethods: ["email", "google"] }),
        logout,
        sendTransaction:wallet?async transaction=>base58((await wallet.signAndSendTransaction({transaction,chain:"solana:devnet" as any})).signature):null,
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
