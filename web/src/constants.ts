import rawAbi from "../../shared/abi/SentinelWallet.json";
import rawAddresses from "../../shared/addresses.json";

// ============================================================================
// DEMO_ONLY: Anvil well-known account #0 private key for local development.
// NEVER use this private key in production or on public networks!
// ============================================================================
export const DEMO_ONLY_OWNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const ANVIL_RPC_URL = "http://127.0.0.1:8545";
export const ANVIL_CHAIN_ID = 31337;

export const WALLET_ABI = rawAbi as any;
export const CONTRACT_ADDRESSES = rawAddresses as {
  chainId: number;
  entryPoint: `0x${string}`;
  wallet: `0x${string}`;
  owner: `0x${string}`;
  agent: `0x${string}`;
  goodRecipient: `0x${string}`;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
