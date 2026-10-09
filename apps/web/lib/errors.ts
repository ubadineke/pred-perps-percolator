// Turns wallet, RPC and on-chain program errors into messages a trader can act on.
// Percolator reports failures as custom program error codes (its PercolatorError enum order).

export type TxAction = "trade" | "close" | "deposit" | "withdraw" | "create" | "faucet";

const PERCOLATOR_ERRORS = [
  "InvalidMagic", "InvalidVersion", "AlreadyInitialized", "NotInitialized", "InvalidAccountKind",
  "InvalidAccountLen", "ExpectedSigner", "ExpectedWritable", "Unauthorized", "InvalidInstruction",
  "InvalidMint", "InvalidTokenAccount", "InvalidVaultAccount", "InvalidTokenProgram", "EngineInvalidConfig",
  "EngineArithmeticOverflow", "EngineProvenanceMismatch", "EngineHiddenLeg", "EngineInvalidLeg", "EngineStale",
  "EngineBStale", "EngineLockActive", "EngineNonProgress", "EngineRecoveryRequired", "EngineCounterOverflow",
  "EngineCounterUnderflow", "OracleInvalid", "OracleStale", "OracleConfTooWide", "InvalidOracleKey",
  "AssetGenerationMismatch", "RentExemptRequired",
] as const;

function programErrorName(message: string): string | undefined {
  const hex = message.match(/custom program error: 0x([0-9a-f]+)/i);
  const decimal = message.match(/Custom\((\d+)\)/);
  const code = hex ? Number.parseInt(hex[1], 16) : decimal ? Number(decimal[1]) : undefined;
  return code === undefined ? undefined : PERCOLATOR_ERRORS[code];
}

/** Returns null when the user cancelled in their wallet (nothing to report). */
export function friendlyError(cause: unknown, action: TxAction): string | null {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/user rejected|rejected the request|cancel/i.test(message)) return null;

  switch (programErrorName(message)) {
    case "EngineLockActive":
      if (action === "withdraw") return "That amount is still backing your open positions. Withdraw less, or close a position first.";
      if (action === "close") return "This market is catching up on price updates. Retry in a few seconds.";
      return "Not enough free collateral for this order. Try a smaller size or deposit more USDC.";
    case "EngineStale":
    case "EngineBStale":
    case "OracleStale":
      return "Market data is updating. Retry in a few seconds.";
    case "EngineHiddenLeg":
      return "Your portfolio can’t open a position in another market right now. Close an existing position first.";
    case "EngineProvenanceMismatch":
    case "AssetGenerationMismatch":
      return "This market changed since the page loaded. Refresh the page and try again.";
    case "EngineRecoveryRequired":
      return "This market is in recovery mode. Trading is paused.";
    case "Unauthorized":
      return "This wallet isn’t allowed to perform that action.";
    case "RentExemptRequired":
      return "Your wallet needs a little more SOL to cover account rent.";
    case "EngineNonProgress":
      return "Nothing to update yet. Retry in a few seconds.";
    default:
      break;
  }
  if (/invalid account data/i.test(message) && (action === "trade" || action === "close")) {
    return "The liquidity provider can’t fill this order right now. Try a smaller size.";
  }
  if (/insufficient funds|0x1\b|insufficient lamports/i.test(message)) {
    return action === "deposit" ? "Not enough USDC in your wallet for this deposit." : "Your wallet doesn’t have enough SOL for network fees.";
  }
  if (/blockhash|expired|timed out|was not confirmed/i.test(message)) {
    return "The network took too long to confirm. Check your wallet activity before retrying.";
  }
  if (/connect a wallet/i.test(message)) return "Connect a wallet first.";
  return message ? `Transaction failed: ${message.slice(0, 140)}` : "Transaction failed.";
}
