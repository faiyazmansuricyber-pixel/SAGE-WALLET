import React, { useState } from "react";
import { parseEther, formatEther, isAddress } from "viem";
import { walletClient, publicClient, ownerAccount } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI, formatEth } from "../constants";
import { buildAndSubmitUserOp, UserOpExecutionResult } from "../userop";
import { AgentAttempt } from "../types";

interface AgentSimulatorProps {
  attempts: AgentAttempt[];
  onNewAttempt: (attempt: AgentAttempt) => void;
  onRefreshPolicy: () => void;
  addToast: (type: "success" | "error" | "pending", title: string, message?: string) => void;
}

export const AgentSimulator: React.FC<AgentSimulatorProps> = ({
  attempts,
  onNewAttempt,
  onRefreshPolicy,
  addToast,
}) => {
  const [target, setTarget] = useState<string>(CONTRACT_ADDRESSES.goodRecipient);
  const [amount, setAmount] = useState<string>("0.5");
  const [calldata, setCalldata] = useState<string>("0x");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<UserOpExecutionResult | null>(null);

  // Approvals & retry state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedAttempts, setApprovedAttempts] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const isForbiddenTarget = (t: string) => {
    const low = t.toLowerCase();
    return (
      low === CONTRACT_ADDRESSES.wallet.toLowerCase() ||
      low === CONTRACT_ADDRESSES.entryPoint.toLowerCase()
    );
  };

  const handleSendAsAgent = async (
    targetAddr: string,
    ethAmount: string,
    callHex: string,
    isRetry = false,
    parentAttemptId?: string
  ) => {
    if (!isAddress(targetAddr)) {
      addToast("error", "Invalid Address", "Please enter a valid 0x recipient target.");
      return;
    }

    let parsedVal: bigint;
    try {
      parsedVal = parseEther(ethAmount);
    } catch {
      addToast("error", "Invalid Amount", "Please enter a valid ETH numerical value.");
      return;
    }

    const formattedData = (
      callHex.startsWith("0x") ? callHex : `0x${callHex}`
    ) as `0x${string}`;

    setIsSubmitting(true);
    addToast("pending", "Submitting UserOp", `Sending ${ethAmount} ETH to ${targetAddr.slice(0, 8)}...`);

    try {
      const result = await buildAndSubmitUserOp({
        target: targetAddr as `0x${string}`,
        value: parsedVal,
        data: formattedData,
      });

      setLastResult(result);

      const isApprovedExecution = isRetry && parentAttemptId && approvedAttempts.has(parentAttemptId);

      const attemptRecord: AgentAttempt = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        target: targetAddr as `0x${string}`,
        value: parsedVal,
        data: formattedData,
        status: result.status,
        txHash: result.txHash,
        reason: result.reason,
        userOpHash: result.userOpHash,
        approved: Boolean(isApprovedExecution),
      };

      onNewAttempt(attemptRecord);
      onRefreshPolicy();

      if (result.status === "EXECUTED") {
        addToast(
          "success",
          isApprovedExecution ? "Executed (Owner-Approved)" : "UserOp Executed",
          `Tx: ${result.txHash?.slice(0, 10)}...`
        );
      } else {
        addToast("error", "UserOp Blocked", result.reason || "Validation rejected");
      }
    } catch (err: any) {
      addToast("error", "Submission Failed", err.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner approves exact call
  const handleApproveCall = async (attempt: AgentAttempt) => {
    if (isForbiddenTarget(attempt.target)) {
      addToast("error", "Cannot Be Approved", "Target is the wallet or EntryPoint (TARGET_FORBIDDEN).");
      return;
    }

    setApprovingId(attempt.id);
    addToast("pending", "Signing Owner Approval", "Executing approveCall on wallet...");

    try {
      // 10 minutes expiry
      const expiry = Math.floor(Date.now() / 1000) + 600;

      const txHash = await walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "approveCall",
        args: [attempt.target, attempt.value, attempt.data, expiry],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setApprovedAttempts((prev) => new Set(prev).add(attempt.id));
      addToast("success", "Call Approved by Owner", "You can now retry this exact call once as agent.");
      onRefreshPolicy();
    } catch (err: any) {
      addToast("error", "Approval Failed", err.shortMessage || err.message || String(err));
    } finally {
      setApprovingId(null);
    }
  };

  // Retry an approved or blocked attempt
  const handleRetry = async (attempt: AgentAttempt) => {
    setRetryingId(attempt.id);
    await handleSendAsAgent(
      attempt.target,
      formatEther(attempt.value),
      attempt.data,
      true,
      attempt.id
    );
    setRetryingId(null);
  };

  return (
    <section className="dashboard-card agent-simulator-panel" id="agent-simulator">
      <div className="card-header">
        <div>
          <h2 className="card-title">Agent Simulator (ERC-4337 UserOp)</h2>
          <p className="card-subtitle">
            Submits live PackedUserOperations signed with the agent key, validated on-chain via EntryPoint v0.8
          </p>
        </div>
        <span className="badge badge-purple">Browser Bundler</span>
      </div>

      {/* Preset Buttons */}
      <div className="simulator-presets">
        <span className="presets-label">Presets:</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          id="preset-allowed-05"
          onClick={() => {
            setTarget(CONTRACT_ADDRESSES.goodRecipient);
            setAmount("0.5");
            setCalldata("0x");
          }}
        >
          Pay allowed recipient 0.5 ETH
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          id="preset-unknown-01"
          onClick={() => {
            setTarget("0x000000000000000000000000000000000000dEaD");
            setAmount("0.1");
            setCalldata("0x");
          }}
        >
          Pay unknown address 0.1 ETH
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          id="preset-allowed-20"
          onClick={() => {
            setTarget(CONTRACT_ADDRESSES.goodRecipient);
            setAmount("2");
            setCalldata("0x");
          }}
        >
          Pay 2 ETH to allowed recipient
        </button>
      </div>

      {/* UserOp Input Form */}
      <form
        className="simulator-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendAsAgent(target, amount, calldata);
        }}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="agent-target">
              Target Address
            </label>
            <input
              id="agent-target"
              type="text"
              className="form-input font-mono"
              placeholder="0x..."
              value={target}
              onChange={(e) => setTarget(e.target.value.trim())}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="agent-amount">
              Amount (ETH)
            </label>
            <input
              id="agent-amount"
              type="text"
              className="form-input"
              placeholder="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group form-col-full">
            <label className="form-label" htmlFor="agent-calldata">
              Calldata (hex)
            </label>
            <input
              id="agent-calldata"
              type="text"
              className="form-input font-mono"
              placeholder="0x"
              value={calldata}
              onChange={(e) => setCalldata(e.target.value.trim())}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            id="btn-send-agent"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span> Simulating & Submitting UserOp...
              </>
            ) : (
              "Send as agent"
            )}
          </button>
        </div>
      </form>

      {/* Latest Result Card */}
      {lastResult && (
        <div
          className={`result-card ${
            lastResult.status === "EXECUTED" ? "result-card-success" : "result-card-blocked"
          }`}
          id="latest-agent-result"
        >
          <div className="result-card-header">
            <span
              className={`badge ${
                lastResult.status === "EXECUTED" ? "badge-green" : "badge-red"
              }`}
            >
              {lastResult.status === "EXECUTED" ? "Executed" : "Blocked"}
            </span>
            <span className="text-xs text-muted font-mono">
              OpHash: {lastResult.userOpHash}
            </span>
          </div>

          <div className="result-card-body">
            {lastResult.status === "EXECUTED" ? (
              <div className="result-detail">
                <span className="detail-label">Transaction Hash:</span>
                <span className="font-mono text-emerald text-sm break-all">
                  {lastResult.txHash}
                </span>
              </div>
            ) : (
              <div className="result-detail">
                <span className="detail-label">Reason:</span>
                <span className="font-mono text-red text-sm font-semibold">
                  {lastResult.reason || "Revert condition met"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reverse-Chronological Attempt History */}
      <div className="attempts-history-section">
        <h3 className="section-subtitle">
          Agent Operation History ({attempts.length})
        </h3>

        {attempts.length === 0 ? (
          <div className="empty-state">No agent requests submitted yet in this session.</div>
        ) : (
          <div className="attempts-table-wrapper">
            <table className="attempts-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Target</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Reason / Tx</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((att) => {
                  const isForbidden = isForbiddenTarget(att.target);
                  const isApproved = approvedAttempts.has(att.id);

                  return (
                    <tr key={att.id} className={`attempt-row-${att.status.toLowerCase()}`}>
                      <td className="text-muted text-xs">
                        {new Date(att.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="font-mono text-xs">
                        {att.target.slice(0, 6)}...{att.target.slice(-4)}
                      </td>
                      <td className="font-mono text-xs font-semibold">
                        {formatEth(att.value, 4)} ETH
                      </td>
                      <td>
                        <div className="status-badge-container">
                          <span
                            className={`badge ${
                              att.status === "EXECUTED" ? "badge-green" : "badge-red"
                            }`}
                          >
                            {att.status}
                          </span>
                          {att.approved && (
                            <span className="badge badge-blue badge-xs">owner-approved</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono text-xs max-w-xs">
                        {att.status === "EXECUTED" ? (
                          <span className="text-emerald text-xs break-all">
                            tx: {att.txHash?.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-red text-xs break-all font-semibold">
                            {att.reason}
                          </span>
                        )}
                      </td>
                      <td>
                        {att.status === "BLOCKED" && (
                          <div className="attempt-actions">
                            {isForbidden ? (
                              <span className="text-xs text-muted italic">
                                cannot be approved
                              </span>
                            ) : !isApproved ? (
                              <button
                                type="button"
                                className="btn btn-blue btn-xs"
                                disabled={approvingId === att.id}
                                onClick={() => handleApproveCall(att)}
                              >
                                {approvingId === att.id ? "Approving..." : "Approve this exact call"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-green btn-xs"
                                disabled={retryingId === att.id}
                                onClick={() => handleRetry(att)}
                              >
                                {retryingId === att.id ? "Retrying..." : "Retry"}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
