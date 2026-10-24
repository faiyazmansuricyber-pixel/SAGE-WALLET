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

const PRESETS = [
  {
    id: "preset-allowed-05",
    label: "Pay allowed recipient 0.5 ETH",
    target: () => CONTRACT_ADDRESSES.goodRecipient,
    amount: "0.5",
    calldata: "0x",
  },
  {
    id: "preset-unknown-01",
    label: "Pay unknown address 0.1 ETH",
    target: () => "0x000000000000000000000000000000000000dEaD",
    amount: "0.1",
    calldata: "0x",
  },
  {
    id: "preset-allowed-20",
    label: "Pay 2 ETH to allowed recipient",
    target: () => CONTRACT_ADDRESSES.goodRecipient,
    amount: "2",
    calldata: "0x",
  },
] as const;

// Inline SVG icons for result badges
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconApproved = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
  </svg>
);

export const AgentSimulator: React.FC<AgentSimulatorProps> = ({
  attempts,
  onNewAttempt,
  onRefreshPolicy,
  addToast,
}) => {
  const [target, setTarget] = useState<string>(CONTRACT_ADDRESSES.goodRecipient);
  const [amount, setAmount] = useState<string>("0.5");
  const [calldata, setCalldata] = useState<string>("0x");
  const [activePreset, setActivePreset] = useState<string | null>("preset-allowed-05");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<UserOpExecutionResult | null>(null);

  // Approvals & retry state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedAttempts, setApprovedAttempts] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
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

      {/* Preset pill chips */}
      <div className="simulator-presets">
        <span className="presets-label">Presets:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            id={preset.id}
            className={`chip ${activePreset === preset.id ? "active" : ""}`}
            onClick={() => {
              setTarget(preset.target());
              setAmount(preset.amount);
              setCalldata(preset.calldata);
              setActivePreset(preset.id);
            }}
          >
            {preset.label}
          </button>
        ))}
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
              onChange={(e) => {
                setTarget(e.target.value.trim());
                setActivePreset(null);
              }}
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
              onChange={(e) => {
                setAmount(e.target.value);
                setActivePreset(null);
              }}
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
              onChange={(e) => {
                setCalldata(e.target.value.trim());
                setActivePreset(null);
              }}
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
                <span className="spinner" /> Simulating &amp; Submitting UserOp…
              </>
            ) : (
              "Send as agent"
            )}
          </button>
        </div>
      </form>

      {/* Latest Result Card — slides in */}
      {lastResult && (
        <div
          className={`result-card ${
            lastResult.status === "EXECUTED" ? "result-card-success" : "result-card-blocked"
          }`}
          id="latest-agent-result"
        >
          <div className="result-card-header">
            <span
              className={`badge badge-lg ${
                lastResult.status === "EXECUTED" ? "badge-green" : "badge-red"
              }`}
            >
              {lastResult.status === "EXECUTED" ? <IconCheck /> : <IconX />}
              {lastResult.status === "EXECUTED" ? "Executed" : "Blocked"}
            </span>
            <span className="text-xs text-muted font-mono" style={{ maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis" }}>
              OpHash: {lastResult.userOpHash?.slice(0, 14)}...
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

      {/* History */}
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
                  const isExpanded = expandedRow === att.id;

                  return (
                    <React.Fragment key={att.id}>
                      <tr className={`attempt-row-${att.status.toLowerCase()}`}>
                        <td className="text-muted text-xs">
                          {new Date(att.timestamp).toLocaleTimeString()}
                        </td>
                        <td
                          className="font-mono text-xs"
                          title={att.target}
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedRow(isExpanded ? null : att.id)}
                        >
                          {att.target.slice(0, 6)}...{att.target.slice(-4)}
                          <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>
                            {isExpanded ? "▴" : "▾"}
                          </span>
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
                              {att.status === "EXECUTED" ? <IconCheck /> : <IconX />}
                              {att.status}
                            </span>
                            {att.approved && (
                              <span className="badge badge-blue badge-xs">
                                <IconApproved /> owner-approved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-xs" style={{ maxWidth: 200 }}>
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
                                <span className="text-xs text-muted" style={{ fontStyle: "italic" }}>
                                  cannot be approved
                                </span>
                              ) : !isApproved ? (
                                <button
                                  type="button"
                                  className="btn btn-blue btn-xs"
                                  disabled={approvingId === att.id}
                                  onClick={() => handleApproveCall(att)}
                                >
                                  {approvingId === att.id ? (
                                    <><span className="spinner" /> Approving…</>
                                  ) : (
                                    "Approve this exact call"
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-green btn-xs"
                                  disabled={retryingId === att.id}
                                  onClick={() => handleRetry(att)}
                                >
                                  {retryingId === att.id ? (
                                    <><span className="spinner" /> Retrying…</>
                                  ) : (
                                    "Retry"
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              background: "var(--surface)",
                              borderBottom: "1px solid var(--border)",
                              padding: "12px 16px",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div className="text-xs">
                                <span className="text-muted font-semibold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Target:</span>{" "}
                                <span className="font-mono break-all">{att.target}</span>
                                <button
                                  className="copy-btn"
                                  style={{ marginLeft: 6 }}
                                  onClick={() => handleCopy(att.target)}
                                  title="Copy address"
                                >⎘</button>
                              </div>
                              {att.userOpHash && (
                                <div className="text-xs">
                                  <span className="text-muted font-semibold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>UserOp Hash:</span>{" "}
                                  <span className="font-mono break-all">{att.userOpHash}</span>
                                  <button
                                    className="copy-btn"
                                    style={{ marginLeft: 6 }}
                                    onClick={() => att.userOpHash && handleCopy(att.userOpHash)}
                                    title="Copy userOp hash"
                                  >⎘</button>
                                </div>
                              )}
                              {att.txHash && (
                                <div className="text-xs">
                                  <span className="text-muted font-semibold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Tx Hash:</span>{" "}
                                  <span className="font-mono break-all text-emerald">{att.txHash}</span>
                                  <button
                                    className="copy-btn"
                                    style={{ marginLeft: 6 }}
                                    onClick={() => att.txHash && handleCopy(att.txHash)}
                                    title="Copy tx hash"
                                  >⎘</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
