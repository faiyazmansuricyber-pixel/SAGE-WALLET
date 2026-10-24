// ============================================================================
// OWNERSHIP: This file is owned by P2 (AI Agent Developer).
// ============================================================================
//
// Attack Runner — executes 5+ reproducible attack scenarios against AgentWallet.
// Each attack attempts an unauthorized action and records whether it was blocked.
// Output: JSON results consumable by docs/ATTACK_RESULTS.md

import { createPublicClient, createWalletClient, http, encodeFunctionData, type Hex, type Address, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import addresses from '../../../shared/addresses.json' assert { type: 'json' };
import abi from '../../../shared/abi/AgentWallet.json' assert { type: 'json' };
import merchantAbi from '../../../shared/abi/MockMerchant.json' assert { type: 'json' };
import { writeFileSync } from 'fs';
import { requiredPrivateKey } from './config.js';

// ── Config ────────────────────────────────────────────────────────────────────

const WALLET_ADDR   = addresses.wallet as Address;
const MERCHANT_ADDR = addresses.merchant as Address;

function getClient(privKey: Hex) {
  return createWalletClient({
    account: privateKeyToAccount(privKey),
    chain: anvil,
    transport: http(process.env.RPC_URL ?? 'http://127.0.0.1:8545'),
  });
}

function getPub() {
  return createPublicClient({
    chain: anvil,
    transport: http(process.env.RPC_URL ?? 'http://127.0.0.1:8545'),
  });
}

// ── Attack result type ────────────────────────────────────────────────────────

interface AttackResult {
  id: number;
  name: string;
  description: string;
  expectedError: string;
  actualError: string;
  blocked: boolean;
  pass: boolean;
}

const results: AttackResult[] = [];

async function runAttack(
  id: number,
  name: string,
  description: string,
  expectedError: string,
  fn: () => Promise<void>
): Promise<void> {
  process.stdout.write(`[Attack #${id}] ${name} ... `);
  let actualError = '';
  let blocked = false;
  try {
    await fn();
    actualError = 'NO_REVERT';
    blocked = false;
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    actualError = extractError(msg);
    blocked = actualError === expectedError;
  }
  const pass = blocked;
  console.log(pass ? '✅ BLOCKED' : '❌ NOT BLOCKED');
  results.push({ id, name, description, expectedError, actualError, blocked, pass });
}

function extractError(msg: string): string {
  const knownErrors = [
    'NotAllowedRecipient', 'ExceedsPerTxLimit', 'ExceedsDailyLimit',
    'PolicyExpired', 'NotOwner', 'NotAgent', 'WalletFrozen',
    'NotAllowedTarget', 'ForbiddenCall', 'ExceedsGasQuota',
  ];
  for (const e of knownErrors) {
    if (msg.includes(e)) return e;
  }
  return 'UNEXPECTED_ERROR';
}

// ── Attack scenarios ──────────────────────────────────────────────────────────

async function main() {
  const agentKey = requiredPrivateKey('AGENT_PRIVATE_KEY');
  const ownerKey = requiredPrivateKey('OWNER_PRIVATE_KEY');
  const attackerKey = requiredPrivateKey('ATTACKER_PRIVATE_KEY');

  console.log('=== Agent Wallet Attack Runner ===');
  console.log('Wallet:', WALLET_ADDR);
  console.log('');

  const agentClient   = getClient(agentKey);
  const ownerClient   = getClient(ownerKey);
  const attackerClient = getClient(attackerKey);
  const attackerAddr  = privateKeyToAccount(attackerKey).address;

  // ── Attack #1 — Prompt-Injection / Non-Allowlisted Recipient ─────────────
  await runAttack(
    1,
    'Prompt-Injection: Send ETH to non-allowlisted attacker',
    'Agent LLM is tricked into sending ETH to a recipient that is not in the allowlist.',
    'NotAllowedRecipient',
    async () => {
      await agentClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'executeAsAgent',
        args: [attackerAddr, parseEther('0.01'), '0x'],
      });
    }
  );

  // ── Attack #2 — Leaked Key: Single Tx Exceeds Per-Tx Limit ───────────────
  await runAttack(
    2,
    'Leaked Key: Single large withdrawal (> maxPerTx)',
    'Attacker uses leaked agent key to withdraw 5 ETH in one transaction.',
    'ExceedsPerTxLimit',
    async () => {
      const data = encodeFunctionData({ abi: merchantAbi as any, functionName: 'buyCredits', args: [5000n] });
      await agentClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'executeAsAgent',
        args: [MERCHANT_ADDR, parseEther('5'), data],
      });
    }
  );

  // ── Attack #3 — Daily Limit Exhaustion (Salami Slicing) ──────────────────
  await runAttack(
    3,
    'Custom call: indirect token spending attempt',
    'An agent custom call must not invoke a router that could use a pre-existing token allowance.',
    'NotAllowedTarget',
    async () => {
      const data = encodeFunctionData({ abi: merchantAbi as any, functionName: 'buyCredits', args: [1n] });
      await agentClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'executeAsAgent',
        args: [MERCHANT_ADDR, 0n, data],
      });
    }
  );

  console.log('[Attack #4] Expired policy replay ... SKIPPED (requires Foundry timestamp warp)');

  // ── Attack #5 — Access Control Bypass: Non-Owner Calls setAgent ──────────
  await runAttack(
    5,
    'Access Control Bypass: Non-owner calls setAgent with unlimited policy',
    'Attacker tries to escalate privileges by calling setAgent(attacker, unlimitedPolicy).',
    'NotOwner',
    async () => {
      const unlimitedPolicy = {
        maxPerTx: 2n ** 256n - 1n,
        dailyLimit: 2n ** 256n - 1n,
        validUntil: 2n ** 48n - 1n,
      };
      await attackerClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'setAgent',
        args: [attackerAddr, unlimitedPolicy],
      });
    }
  );

  // ── Attack #6 (Bonus) — Non-Allowed Selector ─────────────────────────────
  await runAttack(
    6,
    'Non-Allowed Selector: Call transfer() which is not in allowlist',
    'Agent tries to call ERC-20 transfer() on merchant, which is not allowlisted.',
    'NotAllowedTarget',
    async () => {
      const data = encodeFunctionData({
        abi: [{ name: 'transfer', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] }] as any,
        functionName: 'transfer',
        args: [attackerAddr, parseEther('1')],
      });
      await agentClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'executeAsAgent',
        args: [MERCHANT_ADDR, 0n, data],
      });
    }
  );

  // ── Attack #7 (Bonus) — Freeze Bypass ────────────────────────────────────
  await runAttack(
    7,
    'Freeze Bypass: Spend while wallet is frozen',
    'Owner freezes wallet due to suspicious activity. Attacker (leaked key) tries to spend anyway.',
    'WalletFrozen',
    async () => {
      // First freeze
      await ownerClient.writeContract({ address: WALLET_ADDR, abi, functionName: 'freeze', args: [] });
      // Then try to spend
      const data = encodeFunctionData({ abi: merchantAbi as any, functionName: 'buyCredits', args: [1n] });
      await agentClient.writeContract({
        address: WALLET_ADDR, abi,
        functionName: 'executeAsAgent',
        args: [MERCHANT_ADDR, parseEther('0.001'), data],
      });
    }
  );

  // ── Summary ───────────────────────────────────────────────────────────────

  const total   = results.length;
  const blocked = results.filter(r => r.blocked).length;
  const detectionRate = ((blocked / total) * 100).toFixed(1);

  console.log('\n=== Attack Results ===');
  console.log(`Attacks attempted : ${total}`);
  console.log(`Blocked (pass)    : ${blocked}`);
  console.log(`Detection rate    : ${detectionRate}%`);

  const output = {
    timestamp: new Date().toISOString(),
    summary: { total, blocked, detectionRate: `${detectionRate}%` },
    results,
  };

  writeFileSync('attack-results.json', JSON.stringify(output, null, 2));
  console.log('\nResults saved to attack-results.json');
}

main().catch(() => {
  console.error('Attack runner failed. Check required key configuration and the local RPC.');
  process.exitCode = 1;
});
