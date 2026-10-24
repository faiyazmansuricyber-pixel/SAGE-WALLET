import {
  encodeFunctionData,
  decodeErrorResult,
  decodeEventLog,
  Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, bundlerClient, bundlerAccount } from "./client";
import {
  CONTRACT_ADDRESSES,
  WALLET_ABI,
  ENTRY_POINT_ABI,
  DEMO_ONLY_AGENT_PRIVATE_KEY,
} from "./constants";

export interface PackedUserOp {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

export interface UserOpExecutionResult {
  success: boolean;
  status: "EXECUTED" | "BLOCKED";
  txHash?: `0x${string}`;
  userOpHash: `0x${string}`;
  reason?: string;
  signedOp?: PackedUserOp;
}

const ERROR_STRING_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
] as const;

/**
 * Decodes simulation or tx errors from EntryPoint v0.8 or inner wallet contracts.
 */
export function decodeRevertReason(err: any): string {
  const fullText = String(err?.message || err?.shortMessage || err);

  const errorWithData = err?.walk ? err.walk((e: any) => Boolean(e?.data)) : null;
  const rawData: Hex | undefined = errorWithData?.data || err?.data || err?.cause?.data;

  const cause = err?.cause || err;
  if (cause?.errorName === "FailedOp" || cause?.data?.errorName === "FailedOp") {
    const args = cause?.args || cause?.data?.args || [];
    const reasonStr = String(args[1] || "");
    if (reasonStr.includes("AA24") || reasonStr.toLowerCase().includes("signature")) {
      return "Blocked: signature invalid (agent revoked or wrong key)";
    }
    return reasonStr || "FailedOp";
  }

  if (cause?.errorName === "FailedOpWithRevert" || cause?.data?.errorName === "FailedOpWithRevert") {
    const args = cause?.args || cause?.data?.args || [];
    const reasonStr = String(args[1] || "");
    const innerBytes: Hex = args[2];
    if (innerBytes && innerBytes !== "0x") {
      try {
        const decodedInner = decodeErrorResult({
          abi: ERROR_STRING_ABI,
          data: innerBytes,
        });
        if (decodedInner.args?.[0]) {
          return String(decodedInner.args[0]);
        }
      } catch {
        try {
          const decodedWalletErr = decodeErrorResult({
            abi: WALLET_ABI,
            data: innerBytes,
          });
          return decodedWalletErr.errorName || innerBytes;
        } catch {
          return innerBytes;
        }
      }
    }
    return reasonStr;
  }

  if (rawData && typeof rawData === "string" && rawData.startsWith("0x") && rawData.length > 2) {
    try {
      const decodedEp = decodeErrorResult({
        abi: ENTRY_POINT_ABI,
        data: rawData,
      });
      if (decodedEp.errorName === "FailedOp") {
        const reasonStr = String(decodedEp.args?.[1] || "");
        if (reasonStr.includes("AA24") || reasonStr.toLowerCase().includes("signature")) {
          return "Blocked: signature invalid (agent revoked or wrong key)";
        }
        return reasonStr;
      }
      if (decodedEp.errorName === "FailedOpWithRevert") {
        const innerBytes = decodedEp.args?.[2] as Hex;
        if (innerBytes && innerBytes !== "0x") {
          try {
            const decodedInner = decodeErrorResult({
              abi: ERROR_STRING_ABI,
              data: innerBytes,
            });
            return String(decodedInner.args?.[0] || innerBytes);
          } catch {
            return innerBytes;
          }
        }
        return String(decodedEp.args?.[1] || "FailedOpWithRevert");
      }
    } catch {
      try {
        const decodedInner = decodeErrorResult({
          abi: ERROR_STRING_ABI,
          data: rawData,
        });
        return String(decodedInner.args?.[0]);
      } catch {
        return rawData;
      }
    }
  }

  if (fullText.includes("AA24") || fullText.toLowerCase().includes("signature error")) {
    return "Blocked: signature invalid (agent revoked or wrong key)";
  }

  if (err?.shortMessage) return err.shortMessage;
  return fullText;
}

/**
 * Builds, signs and executes a PackedUserOperation for SentinelWallet via EntryPoint v0.8.
 */
export async function buildAndSubmitUserOp(options: {
  target: `0x${string}`;
  value: bigint;
  data?: `0x${string}`;
  customCallData?: `0x${string}`;
  signerKey?: `0x${string}`;
  replayOp?: PackedUserOp;
}): Promise<UserOpExecutionResult> {
  const {
    target,
    value,
    data = "0x",
    customCallData,
    signerKey = DEMO_ONLY_AGENT_PRIVATE_KEY,
    replayOp,
  } = options;

  let signedOp: PackedUserOp;
  let userOpHash: `0x${string}`;

  if (replayOp) {
    signedOp = replayOp;
    userOpHash = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "getUserOpHash",
      args: [signedOp as any],
    } as any)) as `0x${string}`;
  } else {
    // 1. Nonce from EntryPoint
    const nonce = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "getNonce",
      args: [CONTRACT_ADDRESSES.wallet, 0n],
    } as any)) as bigint;

    // 2. CallData: MUST be agentExecute (or customCallData for attacks testing forbidden calls)
    const callData =
      customCallData ||
      encodeFunctionData({
        abi: WALLET_ABI,
        functionName: "agentExecute",
        args: [target, value, data],
      });

    // 3. accountGasLimits: verification (500k) << 128 | callGasLimit (500k)
    const accountGasLimits = (`0x${(500000n).toString(16).padStart(32, "0")}${(500000n)
      .toString(16)
      .padStart(32, "0")}`) as `0x${string}`;

    // 4. gasFees: priority (1 gwei) << 128 | maxFee (5 gwei)
    const gasFees = (`0x${(1000000000n).toString(16).padStart(32, "0")}${(5000000000n)
      .toString(16)
      .padStart(32, "0")}`) as `0x${string}`;

    const preVerificationGas = 100000n;

    const unsignedOp = {
      sender: CONTRACT_ADDRESSES.wallet,
      nonce,
      initCode: "0x" as `0x${string}`,
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData: "0x" as `0x${string}`,
      signature: "0x" as `0x${string}`,
    };

    // 5. On-chain userOpHash
    userOpHash = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "getUserOpHash",
      args: [unsignedOp as any],
    } as any)) as `0x${string}`;

    // 6. Sign raw 32-byte hash (NO "\x19Ethereum Signed Message" prefix)
    const signer = privateKeyToAccount(signerKey);
    const signature = await signer.sign({ hash: userOpHash });

    signedOp = {
      ...unsignedOp,
      signature,
    };
  }

  // 7. ALWAYS simulate handleOps first to catch validation phase reverts
  try {
    await publicClient.simulateContract({
      account: bundlerAccount,
      address: CONTRACT_ADDRESSES.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "handleOps",
      args: [[signedOp as any], bundlerAccount.address],
    } as any);
  } catch (simError: any) {
    const reason = decodeRevertReason(simError);
    return {
      success: false,
      status: "BLOCKED",
      userOpHash,
      reason,
      signedOp,
    };
  }

  // 8. Simulation succeeded -> Send the transaction to the EntryPoint
  try {
    const txHash = (await bundlerClient.writeContract({
      address: CONTRACT_ADDRESSES.entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: "handleOps",
      args: [[signedOp as any], bundlerAccount.address],
    } as any)) as `0x${string}`;

    // Wait for the receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // 9. Check execution-phase events
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CONTRACT_ADDRESSES.entryPoint.toLowerCase()) {
        try {
          const parsed: any = decodeEventLog({
            abi: ENTRY_POINT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (parsed.eventName === "UserOperationRevertReason") {
            const rawRevert = parsed.args?.revertReason as Hex;
            let decodedReason = String(rawRevert);
            try {
              const inner = decodeErrorResult({
                abi: ERROR_STRING_ABI,
                data: rawRevert,
              });
              decodedReason = String(inner.args?.[0]);
            } catch {
              // Raw or custom error
            }
            return {
              success: false,
              status: "BLOCKED",
              txHash,
              userOpHash,
              reason: decodedReason,
              signedOp,
            };
          }
        } catch {
          // Non-matching event log, continue
        }
      }
    }

    // Check if wallet Executed event was emitted
    let executedEmitted = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CONTRACT_ADDRESSES.wallet.toLowerCase()) {
        try {
          const parsed: any = decodeEventLog({
            abi: WALLET_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (parsed.eventName === "Executed") {
            executedEmitted = true;
            break;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!executedEmitted) {
      return {
        success: false,
        status: "BLOCKED",
        txHash,
        userOpHash,
        reason: "Executed event not found in transaction receipt",
        signedOp,
      };
    }

    return {
      success: true,
      status: "EXECUTED",
      txHash,
      userOpHash,
      signedOp,
    };
  } catch (txError: any) {
    const reason = decodeRevertReason(txError);
    return {
      success: false,
      status: "BLOCKED",
      userOpHash,
      reason,
      signedOp,
    };
  }
}
