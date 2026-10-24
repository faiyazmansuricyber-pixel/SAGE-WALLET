import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ANVIL_RPC_URL,
  ANVIL_CHAIN_ID,
  DEMO_ONLY_OWNER_PRIVATE_KEY,
} from "./constants";

export const anvilChain = defineChain({
  id: ANVIL_CHAIN_ID,
  name: "Anvil Localhost",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ANVIL_RPC_URL],
    },
  },
});

export const ownerAccount = privateKeyToAccount(DEMO_ONLY_OWNER_PRIVATE_KEY);

export const publicClient = createPublicClient({
  chain: anvilChain,
  transport: http(ANVIL_RPC_URL),
});

export const walletClient = createWalletClient({
  account: ownerAccount,
  chain: anvilChain,
  transport: http(ANVIL_RPC_URL),
});
