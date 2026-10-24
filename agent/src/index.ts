// ============================================================================
// OWNERSHIP: This file is owned by P2 (AI Agent Developer).
// ============================================================================
//
// Agent Wallet Bot — reads policy, sends buyCredits via executeAsAgent,
// detects suspicious conditions and triggers autoFreeze.

import { encodeFunctionData, type Hex, type Address, formatEther } from 'viem';
import { submitUserOperation, getPublicClient, getWalletClient } from '../../shared/userop/builder.js';
import addresses from '../../shared/addresses.json' assert { type: 'json' };
import abi from '../../shared/abi/AgentWallet.json' assert { type: 'json' };
import merchantAbi from '../../shared/abi/MockMerchant.json' assert { type: 'json' };

// ── Config ────────────────────────────────────────────────────────────────────

const OWNER_KEY = (process.env.OWNER_PRIVATE_KEY ?? '') as Hex;
const AGENT_KEY  = (process.env.AGENT_PRIVATE_KEY ?? '') as Hex;

if (!OWNER_KEY || !AGENT_KEY) {
  console.error('ERROR: Set OWNER_PRIVATE_KEY and AGENT_PRIVATE_KEY in .env');
  process.exit(1);
}

const WALLET_ADDR   = addresses.wallet as Address;
const MERCHANT_ADDR = addresses.merchant as Address;

// Suspicious-spending threshold: if agent attempts > 80% of daily limit in one session → auto-freeze
const SUSPICIOUS_THRESHOLD_PCT = 80n;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readPolicy() {
  const pub = getPublicClient();
  const policy = await pub.readContract({
    address: WALLET_ADDR,
    abi,
    functionName: 'getPolicy',
  }) as { maxPerTx: bigint; dailyLimit: bigint; validUntil: bigint };

  const spent = await pub.readContract({
    address: WALLET_ADDR,
    abi,
    functionName: 'spentToday',
  }) as bigint;

  const frozen = await pub.readContract({
    address: WALLET_ADDR,
    abi,
    functionName: 'frozen',
  }) as boolean;

  return { policy, spent, frozen };
}

async function detectSuspicious(spent: bigint, dailyLimit: bigint, attemptValue: bigint): Promise<boolean> {
  if (dailyLimit === 0n) return false;
  const pct = ((spent + attemptValue) * 100n) / dailyLimit;
  return pct >= SUSPICIOUS_THRESHOLD_PCT;
}

// ── Main agent loop ───────────────────────────────────────────────────────────

async function runBot() {
  console.log('=== Agent Wallet Bot ===');
  console.log('Wallet  :', WALLET_ADDR);
  console.log('Merchant:', MERCHANT_ADDR);

  const { policy, spent, frozen } = await readPolicy();
  const now = BigInt(Math.floor(Date.now() / 1000));

  console.log('\n--- Current State ---');
  console.log('maxPerTx   :', formatEther(policy.maxPerTx), 'ETH');
  console.log('dailyLimit :', formatEther(policy.dailyLimit), 'ETH');
  console.log('validUntil :', new Date(Number(policy.validUntil) * 1000).toISOString());
  console.log('spentToday :', formatEther(spent), 'ETH');
  console.log('frozen     :', frozen);

  if (frozen) {
    console.log('\n[BOT] Wallet is frozen — halting.');
    return;
  }

  if (now > policy.validUntil) {
    console.log('\n[BOT] Policy expired — halting. Owner must set a new agent.');
    return;
  }

  // Intended purchase: 10 credits at 0.001 ETH each = 0.01 ETH
  const units = 10n;
  const paymentPerUnit = 1_000_000_000_000_000n; // 0.001 ETH
  const value = units * paymentPerUnit;

  console.log('\n[BOT] Intending to buy', units, 'credits for', formatEther(value), 'ETH');

  // Check against policy before even trying
  if (value > policy.maxPerTx) {
    console.log('[BOT] BLOCKED (pre-flight): value exceeds maxPerTx');
    return;
  }
  if (spent + value > policy.dailyLimit) {
    console.log('[BOT] BLOCKED (pre-flight): would exceed dailyLimit');
    return;
  }

  // Suspicious-spending detection
  const suspicious = await detectSuspicious(spent, policy.dailyLimit, value);
  if (suspicious) {
    console.log('[BOT] ⚠️  SUSPICIOUS: spend would exceed', Number(SUSPICIOUS_THRESHOLD_PCT), '% of daily limit');
    console.log('[BOT] Triggering autoFreeze on-chain...');
    const agentWallet = getWalletClient(AGENT_KEY);
    await agentWallet.writeContract({
      address: WALLET_ADDR,
      abi,
      functionName: 'autoFreeze',
    });
    console.log('[BOT] autoFreeze submitted. Halting.');
    return;
  }

  // Submit through the configured ERC-4337 v0.7 bundler and paymaster.
  const data = encodeFunctionData({
    abi: merchantAbi as any,
    functionName: 'buyCredits',
    args: [units],
  });

  console.log('[BOT] Preparing sponsored ERC-4337 UserOperation...');
  try {
    const { userOpHash, receipt } = await submitUserOperation(
      { target: MERCHANT_ADDR, value, data },
      AGENT_KEY,
    );
    console.log('[BOT] ✅ UserOperation included:', userOpHash);
    console.log('[BOT] Transaction:', receipt.receipt.transactionHash);
    console.log('[BOT] Actual gas cost:', receipt.actualGasCost.toString());
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.log('[BOT] ❌ Transaction REJECTED:', msg);

    // Parse on-chain revert for demo log
    if (msg.includes('ExceedsPerTxLimit'))    console.log('[BOT] Reason: ExceedsPerTxLimit');
    if (msg.includes('ExceedsDailyLimit'))    console.log('[BOT] Reason: ExceedsDailyLimit');
    if (msg.includes('PolicyExpired'))        console.log('[BOT] Reason: PolicyExpired');
    if (msg.includes('NotAllowedTarget'))     console.log('[BOT] Reason: NotAllowedTarget');
    if (msg.includes('NotAllowedRecipient'))  console.log('[BOT] Reason: NotAllowedRecipient');
    if (msg.includes('WalletFrozen'))         console.log('[BOT] Reason: WalletFrozen');
  }
}

runBot().catch(console.error);
