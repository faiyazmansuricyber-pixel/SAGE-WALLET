// set-daily-limit-5.cjs
// Reads the current policy, then calls setPolicy(perTxLimit, 5 ETH, validUntil)
// Uses owner account #0 (Anvil default) to sign the transaction.

const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require("viem");
const { anvil } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const path = require("path");

const addresses = require(path.resolve(__dirname, "../shared/addresses.json"));
const rawAbi = require(path.resolve(__dirname, "../shared/abi/SentinelWallet.json"));

const OWNER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RPC = "http://127.0.0.1:8545";

// ABI extensions for functions that might not be in the base ABI
const ABI_EXTENSIONS = [
  {
    type: "function",
    name: "setPolicy",
    inputs: [
      { name: "perTxLimit_", type: "uint256" },
      { name: "dailyLimit_", type: "uint256" },
      { name: "validUntil_", type: "uint48" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "perTxLimit",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "dailyLimit",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "validUntil",
    inputs: [],
    outputs: [{ name: "", type: "uint48" }],
    stateMutability: "view"
  }
];

const rawNames = new Set(rawAbi.map(x => x.name).filter(Boolean));
const WALLET_ABI = [...rawAbi, ...ABI_EXTENSIONS.filter(x => !rawNames.has(x.name))];

async function main() {
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain: anvil, transport });
  const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
  const walletClient = createWalletClient({ chain: anvil, transport, account: ownerAccount });

  const walletAddr = addresses.wallet;
  console.log("Wallet address:", walletAddr);

  // Read current on-chain values
  const [currentPerTx, currentDaily, currentValidUntil] = await Promise.all([
    publicClient.readContract({ address: walletAddr, abi: WALLET_ABI, functionName: "perTxLimit" }),
    publicClient.readContract({ address: walletAddr, abi: WALLET_ABI, functionName: "dailyLimit" }),
    publicClient.readContract({ address: walletAddr, abi: WALLET_ABI, functionName: "validUntil" }),
  ]);

  console.log("Current perTxLimit:", formatEther(currentPerTx), "ETH");
  console.log("Current dailyLimit:", formatEther(currentDaily), "ETH");
  console.log("Current validUntil:", Number(currentValidUntil), "(unix timestamp)");

  // New daily limit = 5 ETH, keep perTxLimit and validUntil the same
  const newDailyLimit = parseEther("5");
  const perTxToUse = currentPerTx;
  let validUntilToUse = Number(currentValidUntil);

  // If validUntil is expired or zero, set a fresh 7-day expiry
  const now = Math.floor(Date.now() / 1000);
  if (validUntilToUse <= now) {
    validUntilToUse = now + 7 * 24 * 3600;
    console.log("validUntil was expired/zero, setting fresh 7-day expiry:", validUntilToUse);
  }

  // Ensure perTxLimit <= newDailyLimit
  if (perTxToUse > newDailyLimit) {
    console.error("ERROR: Current perTxLimit", formatEther(perTxToUse), "exceeds new dailyLimit 5 ETH.");
    console.error("Please lower perTxLimit first.");
    process.exit(1);
  }

  console.log("\nSending setPolicy(" + formatEther(perTxToUse) + " ETH, 5.0 ETH, " + validUntilToUse + ")...");

  const hash = await walletClient.writeContract({
    address: walletAddr,
    abi: WALLET_ABI,
    functionName: "setPolicy",
    args: [perTxToUse, newDailyLimit, validUntilToUse],
  });

  console.log("Tx hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);
  console.log("Block:", receipt.blockNumber.toString());

  // Verify
  const updatedDaily = await publicClient.readContract({
    address: walletAddr,
    abi: WALLET_ABI,
    functionName: "dailyLimit",
  });
  console.log("\nVerification - dailyLimit now:", formatEther(updatedDaily), "ETH");

  if (updatedDaily === newDailyLimit) {
    console.log("SUCCESS: Daily limit updated to 5 ETH.");
  } else {
    console.error("UNEXPECTED: dailyLimit is", formatEther(updatedDaily), "instead of 5 ETH.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
