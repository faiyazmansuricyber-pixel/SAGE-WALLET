// ============================================================================
// OWNERSHIP: This file is owned by P2 (AI Agent Developer).
// Owned path: shared/userop/
// ============================================================================

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import {
  createBundlerClient,
  estimateUserOperationGas,
  getUserOperationHash,
  sendUserOperation,
  waitForUserOperationReceipt,
  type UserOperation,
} from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import { isAddress, getAddress } from 'viem';
import addresses from '../../shared/addresses.json' assert { type: 'json' };
import abi from '../../shared/abi/AgentWallet.json' assert { type: 'json' };

export interface AgentCall {
  target: Address;
  value: bigint;
  data: Hex;
}

const ENTRY_POINT_ABI = [{
  type: 'function',
  name: 'getNonce',
  stateMutability: 'view',
  inputs: [
    { name: 'sender', type: 'address' },
    { name: 'key', type: 'uint192' },
  ],
  outputs: [{ name: 'nonce', type: 'uint256' }],
}] as const;

function configuredAddress(name: string): Address {
  const value = process.env[name];
  if (!value || !isAddress(value)) {
    throw new Error(`${name} must be set to a valid address`);
  }
  return getAddress(value);
}

function getBundlerClient() {
  const bundlerUrl = process.env.BUNDLER_RPC_URL;
  if (!bundlerUrl) throw new Error('BUNDLER_RPC_URL must point to an ERC-4337 bundler');
  return createBundlerClient({
    chain: anvil,
    transport: http(bundlerUrl),
  });
}

export async function submitUserOperation(call: AgentCall, agentPrivKey: Hex) {
  const walletAddress = getAddress(addresses.wallet);
  const entryPointAddress = configuredAddress('ENTRYPOINT_ADDRESS');
  const paymasterAddress = configuredAddress('PAYMASTER_ADDRESS');
  const publicClient = getPublicClient();
  const bundlerClient = getBundlerClient();
  const chainId = await publicClient.getChainId();
  const nonce = await publicClient.readContract({
    address: entryPointAddress,
    abi: ENTRY_POINT_ABI,
    functionName: 'getNonce',
    args: [walletAddress, 0n],
  });
  const callData = encodeFunctionData({
    abi,
    functionName: 'executeAsAgent',
    args: [call.target, call.value, call.data],
  });
  const fees = await publicClient.estimateFeesPerGas({ type: 'eip1559' });
  if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) {
    throw new Error('RPC did not return EIP-1559 fees required by EntryPoint v0.7');
  }

  const account = privateKeyToAccount(agentPrivKey);
  const initialUserOp: UserOperation<'0.7'> = {
    sender: walletAddress,
    nonce,
    callData,
    callGasLimit: 500_000n,
    verificationGasLimit: 500_000n,
    preVerificationGas: 100_000n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    paymaster: paymasterAddress,
    paymasterVerificationGasLimit: 100_000n,
    paymasterPostOpGasLimit: 100_000n,
    paymasterData: '0x',
    signature: '0x',
  };
  const sign = async (userOperation: UserOperation<'0.7'>): Promise<Hex> => {
    const hash = getUserOperationHash({
      chainId,
      entryPointAddress,
      entryPointVersion: '0.7',
      userOperation,
    });
    return account.signMessage({ message: { raw: hash } });
  };

  const preliminarySignature = await sign(initialUserOp);
  const gas = await estimateUserOperationGas(bundlerClient, {
    ...initialUserOp,
    signature: preliminarySignature,
    entryPointAddress,
  });
  const userOp: UserOperation<'0.7'> = {
    ...initialUserOp,
    callGasLimit: gas.callGasLimit,
    verificationGasLimit: gas.verificationGasLimit,
    preVerificationGas: gas.preVerificationGas,
    paymasterVerificationGasLimit:
      gas.paymasterVerificationGasLimit ?? initialUserOp.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit:
      gas.paymasterPostOpGasLimit ?? initialUserOp.paymasterPostOpGasLimit,
    signature: '0x',
  };
  userOp.signature = await sign(userOp);

  const userOpHash = await sendUserOperation(bundlerClient, {
    ...userOp,
    entryPointAddress,
  });
  const receipt = await waitForUserOperationReceipt(bundlerClient, {
    hash: userOpHash,
    timeout: 120_000,
  });
  if (!receipt.success) throw new Error(`UserOperation execution failed: ${receipt.reason ?? userOpHash}`);
  return { userOpHash, receipt };
}

export function getPublicClient() {
  return createPublicClient({
    chain: anvil,
    transport: http(process.env.RPC_URL ?? 'http://127.0.0.1:8545'),
  });
}

export function getWalletClient(privKey: Hex) {
  return createWalletClient({
    account: privateKeyToAccount(privKey),
    chain: anvil,
    transport: http(process.env.RPC_URL ?? 'http://127.0.0.1:8545'),
  });
}
