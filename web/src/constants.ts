import rawAbi from "../../shared/abi/AgentWallet.json";
import rawAddresses from "../../shared/addresses.json";
import rawEntryPointAbi from "./abi/EntryPoint.json";
import { DEMO_ONLY_OWNER_PRIVATE_KEY, DEMO_ONLY_AGENT_PRIVATE_KEY } from "./demoKeys";

export { DEMO_ONLY_OWNER_PRIVATE_KEY, DEMO_ONLY_AGENT_PRIVATE_KEY };

export const ANVIL_RPC_URL = "http://127.0.0.1:8545";
export const ANVIL_CHAIN_ID = 31337;

// Missing SentinelWallet methods & events not in basic rawAbi
const SENTINEL_ABI_EXTENSIONS = [
  {
    type: "function",
    name: "agentExecute",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "approveCall",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
      { name: "expiry", type: "uint48", internalType: "uint48" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "approvalExpiry",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint48", internalType: "uint48" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "setCallAllowed",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "selector", type: "bytes4", internalType: "bytes4" },
      { name: "allowed", type: "bool", internalType: "bool" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "to", type: "address", internalType: "address payable" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "Executed",
    inputs: [
      { name: "target", type: "address", indexed: true, internalType: "address" },
      { name: "value", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "selector", type: "bytes4", indexed: false, internalType: "bytes4" },
      { name: "approved", type: "bool", indexed: false, internalType: "bool" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "ApprovalSet",
    inputs: [
      { name: "callHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "expiry", type: "uint48", indexed: false, internalType: "uint48" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "ApprovalUsed",
    inputs: [
      { name: "callHash", type: "bytes32", indexed: true, internalType: "bytes32" }
    ],
    anonymous: false
  }
];

// Merge rawAbi with extension items not already in rawAbi
const rawAbiNames = new Set((rawAbi as Array<{ name?: string }>).map((x) => x.name).filter(Boolean));
export const WALLET_ABI = [
  ...(rawAbi as any[]),
  ...SENTINEL_ABI_EXTENSIONS.filter((x) => !rawAbiNames.has(x.name))
] as const;

export const ENTRY_POINT_ABI = rawEntryPointAbi as any;

// Addresses come strictly from shared/addresses.json (written by deploy script)
export const CONTRACT_ADDRESSES = rawAddresses as {
  chainId: number;
  entryPoint: `0x${string}`;
  wallet: `0x${string}`;
  owner: `0x${string}`;
  agent: `0x${string}`;
  goodRecipient: `0x${string}`;
};

/**
 * Format ETH amounts to at most 4 decimal places without trailing zeros
 */
export function formatEth(val: bigint | number | string | undefined | null, maxDecimals = 4): string {
  if (val === undefined || val === null) return "-";
  let str: string;
  if (typeof val === "bigint") {
    // Convert wei to ETH
    const isNegative = val < 0n;
    const absVal = isNegative ? -val : val;
    const base = absVal.toString().padStart(19, "0");
    const intPart = base.slice(0, -18) || "0";
    const fracPart = base.slice(-18);
    str = `${isNegative ? "-" : ""}${intPart}.${fracPart}`;
  } else {
    str = String(val);
  }

  const parts = str.split(".");
  if (parts.length === 1) return parts[0];
  const truncatedFrac = parts[1].slice(0, maxDecimals).replace(/0+$/, "");
  return truncatedFrac.length > 0 ? `${parts[0]}.${truncatedFrac}` : parts[0];
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
