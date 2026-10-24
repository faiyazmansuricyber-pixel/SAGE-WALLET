import React, { useState, useEffect } from "react";
import { parseEther, formatEther, isAddress } from "viem";
import { walletClient, publicClient, ownerAccount } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI, formatEth } from "../constants";
import { TxStatus, WalletPolicy, Toast } from "../types";

interface ActionFormsProps {
  policy: WalletPolicy | null;
  onActionComplete: () => void;
  addToast: (type: Toast["type"], title: string, message?: string) => void;
}

type TabType = "policy" | "recipient" | "fundWallet" | "deposit" | "agent";

export const ActionForms: React.FC<ActionFormsProps> = ({
  policy,
  onActionComplete,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("policy");
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set Policy state
  const [perTxLimit, setPerTxLimit] = useState("1.0");
  const [dailyLimit, setDailyLimit] = useState("3.0");
  const [expiryHours, setExpiryHours] = useState("168");
  const [showPolicyConfirm, setShowPolicyConfirm] = useState(false);

  // Validation errors
  const [policyError, setPolicyError] = useState<string | null>(null);

  // Set Recipient state
  const [recipientAddress, setRecipientAddress] = useState<string>(
    CONTRACT_ADDRESSES.goodRecipient || ""
  );
  const [isRecipientAllowed, setIsRecipientAllowed] = useState(true);

  // Fund Wallet state
  const [fundWalletAmount, setFundWalletAmount] = useState("2.0");

  // Add Deposit state
  const [depositAmount, setDepositAmount] = useState("1.0");

  // Agent Management state
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [newAgentAddress, setNewAgentAddress] = useState<string>(CONTRACT_ADDRESSES.agent);

  // Prefill policy form inputs from on-chain values when policy loads
  useEffect(() => {
    if (policy && policy.perTxLimit > 0n) {
      setPerTxLimit(formatEther(policy.perTxLimit));
    } else {
      setPerTxLimit("1.0");
    }

    if (policy && policy.dailyLimit > 0n) {
      setDailyLimit(formatEther(policy.dailyLimit));
    } else {
      setDailyLimit("3.0");
    }

    if (policy && policy.validUntil > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const remainingSec = policy.validUntil - nowSec;
      if (remainingSec > 0) {
        setExpiryHours((remainingSec / 3600).toFixed(1));
      } else {
        setExpiryHours("168");
      }
    } else {
      setExpiryHours("168");
    }
  }, [policy?.perTxLimit, policy?.dailyLimit, policy?.validUntil]);

  const currentPerTx = policy && policy.perTxLimit > 0n ? formatEth(policy.perTxLimit, 4) : "None";
  const currentDaily = policy && policy.dailyLimit > 0n ? formatEth(policy.dailyLimit, 4) : "None";
  const currentHoursLeft =
    policy && policy.validUntil > 0
      ? Math.max(0, (policy.validUntil - Math.floor(Date.now() / 1000)) / 3600).toFixed(1)
      : "None";

  const parseRevertReason = (err: any): string => {
    if (err?.shortMessage) return err.shortMessage;
    if (err?.cause?.reason) return err.cause.reason;
    if (err?.data?.errorName) return `Reverted: ${err.data.errorName}`;
    if (err?.message) {
      const match = err.message.match(/reverted with the following reason:\s*(.+)/i);
      if (match && match[1]) return match[1];
      return err.message.slice(0, 200);
    }
    return "Transaction failed";
  };

  const executeTx = async (
    actionName: string,
    sendFn: () => Promise<`0x${string}`>
  ) => {
    setIsSubmitting(true);
    setTxStatus({
      status: "pending",
      message: `Broadcasting ${actionName} to Anvil...`,
    });
    addToast("pending", `${actionName}`, "Broadcasting to Anvil...");

    try {
      const hash = await sendFn();
      setTxStatus({
        status: "pending",
        hash,
        message: `${actionName} submitted. Waiting for confirmation...`,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setTxStatus({
          status: "success",
          hash,
          message: `${actionName} confirmed in block #${receipt.blockNumber}!`,
        });
        addToast("success", `${actionName} Confirmed`, `Tx: ${hash.slice(0, 10)}...`);
        onActionComplete();
      } else {
        setTxStatus({
          status: "error",
          hash,
          error: "Transaction reverted on chain.",
        });
        addToast("error", `${actionName} Reverted`, "Transaction execution reverted.");
      }
    } catch (err: any) {
      const reason = parseRevertReason(err);
      setTxStatus({
        status: "error",
        error: reason,
      });
      addToast("error", `${actionName} Failed`, reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Set Policy handler
  const handleSetPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyError(null);

    if (!showPolicyConfirm) {
      setShowPolicyConfirm(true);
      return;
    }

    setShowPolicyConfirm(false);

    let perTxWei: bigint;
    let dailyWei: bigint;
    try {
      perTxWei = parseEther(perTxLimit);
      dailyWei = parseEther(dailyLimit);
    } catch {
      setPolicyError("Invalid numeric ETH values.");
      setTxStatus({ status: "error", error: "Invalid numeric ETH values." });
      return;
    }

    if (perTxWei > dailyWei) {
      setPolicyError("Per-tx limit cannot exceed daily limit (PERTX_GT_DAILY).");
      setTxStatus({
        status: "error",
        error: "Per-tx limit cannot exceed daily limit (PERTX_GT_DAILY).",
      });
      return;
    }

    const hours = parseFloat(expiryHours);
    if (isNaN(hours) || hours <= 0) {
      setPolicyError("Expiry hours must be greater than 0.");
      setTxStatus({ status: "error", error: "Expiry hours must be greater than 0." });
      return;
    }

    const validUntilTimestamp = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);

    await executeTx("Set Policy", () =>
      walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "setPolicy",
        args: [perTxWei, dailyWei, validUntilTimestamp],
      })
    );
  };

  // 2. Set Recipient handler
  const handleSetRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(recipientAddress)) {
      setTxStatus({ status: "error", error: "Invalid Ethereum address." });
      return;
    }

    await executeTx(`Set Recipient (${isRecipientAllowed ? "Allow" : "Disallow"})`, () =>
      walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "setRecipient",
        args: [recipientAddress as `0x${string}`, isRecipientAllowed],
      })
    );
  };

  // 3. Fund Wallet handler
  const handleFundWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    let val: bigint;
    try {
      val = parseEther(fundWalletAmount);
    } catch {
      setTxStatus({ status: "error", error: "Invalid ETH amount." });
      return;
    }

    await executeTx("Fund Wallet", () =>
      walletClient.sendTransaction({
        account: ownerAccount,
        to: CONTRACT_ADDRESSES.wallet,
        value: val,
      })
    );
  };

  // 4. Add Deposit to EntryPoint handler
  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    let val: bigint;
    try {
      val = parseEther(depositAmount);
    } catch {
      setTxStatus({ status: "error", error: "Invalid ETH amount." });
      return;
    }

    await executeTx("Add EntryPoint Deposit", () =>
      walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "addDeposit",
        args: [],
        value: val,
      } as any)
    );
  };

  // 5. Revoke Agent handler
  const handleRevokeAgent = async () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setConfirmRevoke(false);

    await executeTx("Revoke Agent", () =>
      walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "revokeAgent",
        args: [],
      } as any)
    );
  };

  // 6. Restore / Set Agent handler
  const handleSetAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(newAgentAddress)) {
      setTxStatus({ status: "error", error: "Invalid agent address." });
      return;
    }

    await executeTx("Set Agent", () =>
      walletClient.writeContract({
        account: ownerAccount,
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "setAgent",
        args: [newAgentAddress as `0x${string}`],
      })
    );
  };

  return (
    <section className="dashboard-card owner-controls-panel" id="owner-controls">
      <div className="card-header">
        <div>
          <h2 className="card-title">Owner Administration Controls</h2>
          <p className="card-subtitle">
            Configure spending boundaries, allowlists, gas deposits, and agent delegation
          </p>
        </div>
        <span className="badge badge-purple">Account #0 (Owner)</span>
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist">
        {(
          [
            { id: "policy", label: "Set Policy" },
            { id: "recipient", label: "Allowlist" },
            { id: "fundWallet", label: "Fund Wallet" },
            { id: "deposit", label: "Gas Deposit" },
            { id: "agent", label: "Agent Key" },
          ] as { id: TabType; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "policy") setShowPolicyConfirm(false);
              if (tab.id !== "agent") setConfirmRevoke(false);
              setTxStatus({ status: "idle" });
              setPolicyError(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* TAB 1: SET POLICY */}
        {activeTab === "policy" && (
          <form onSubmit={handleSetPolicy} className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="policy-pertx">
                Per-Transaction Limit (ETH)
              </label>
              <input
                id="policy-pertx"
                type="text"
                className="form-input"
                value={perTxLimit}
                onChange={(e) => { setPerTxLimit(e.target.value); setPolicyError(null); }}
                required
              />
              <span className="form-hint">
                current: {currentPerTx} ETH
              </span>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="policy-daily"
                title="Maximum ETH the agent may spend across all transactions in one UTC day"
              >
                Daily Limit (ETH)
              </label>
              <input
                id="policy-daily"
                type="text"
                className="form-input"
                value={dailyLimit}
                onChange={(e) => { setDailyLimit(e.target.value); setPolicyError(null); }}
                required
              />
              <span className="form-hint">
                current: {currentDaily} ETH
              </span>
            </div>

            <div className="form-group form-col-full">
              <label className="form-label" htmlFor="policy-expiry">
                Policy Validity Duration (Hours from now)
              </label>
              <input
                id="policy-expiry"
                type="text"
                className="form-input"
                value={expiryHours}
                onChange={(e) => { setExpiryHours(e.target.value); setPolicyError(null); }}
                required
              />
              <span className="form-hint">
                current remaining: {currentHoursLeft} hours
              </span>
            </div>

            {policyError && (
              <div className="form-error form-col-full">⚠ {policyError}</div>
            )}

            {/* Confirmation Box */}
            {showPolicyConfirm && (
              <div className="confirm-box form-col-full">
                <div className="confirm-text text-sm">
                  <strong>Confirm Policy Replacement:</strong>
                  <br />
                  Old: {currentPerTx} ETH / {currentDaily} ETH ({currentHoursLeft}h)
                  <br />
                  New: {perTxLimit} ETH / {dailyLimit} ETH ({expiryHours}h)
                </div>
                <div className="confirm-actions">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <><span className="spinner" /> Applying…</> : "Yes, Apply New Policy"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPolicyConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showPolicyConfirm && (
              <div className="form-col-full">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <><span className="spinner" /> Updating Policy…</> : "Update Policy"}
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: RECIPIENT (ALLOWLIST) */}
        {activeTab === "recipient" && (
          <form onSubmit={handleSetRecipient} className="form-grid">
            <div className="form-group form-col-full">
              <label className="form-label" htmlFor="rec-address">
                Recipient Address
              </label>
              <input
                id="rec-address"
                type="text"
                className="form-input font-mono"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value.trim())}
                required
              />
              <span className="form-hint">
                Good recipient preset: {CONTRACT_ADDRESSES.goodRecipient}
              </span>
              {recipientAddress && !isAddress(recipientAddress) && (
                <span className="form-error">⚠ Not a valid Ethereum address</span>
              )}
            </div>

            <div className="form-group form-col-full">
              <label className="form-label">Allowlist Status</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="allowOption"
                    checked={isRecipientAllowed}
                    onChange={() => setIsRecipientAllowed(true)}
                  />
                  <span>Allowed (Agent can transfer ETH to this address)</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="allowOption"
                    checked={!isRecipientAllowed}
                    onChange={() => setIsRecipientAllowed(false)}
                  />
                  <span>Disallowed (Block agent transfers)</span>
                </label>
              </div>
            </div>

            <div className="form-col-full">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><span className="spinner" /> Updating Recipient…</> : "Save Recipient Setting"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: FUND WALLET */}
        {activeTab === "fundWallet" && (
          <form onSubmit={handleFundWallet} className="form-grid">
            <div className="form-group form-col-full">
              <label className="form-label" htmlFor="fund-amount">
                ETH Amount to Send to Wallet
              </label>
              <input
                id="fund-amount"
                type="text"
                className="form-input"
                placeholder="2.0"
                value={fundWalletAmount}
                onChange={(e) => setFundWalletAmount(e.target.value)}
                required
              />
              <span className="form-hint">
                Transfers native ETH from Owner account #0 directly to Sentinel Wallet address
              </span>
            </div>

            <div className="form-col-full">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><span className="spinner" /> Funding Wallet…</> : "Fund Wallet with ETH"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: GAS DEPOSIT */}
        {activeTab === "deposit" && (
          <form onSubmit={handleAddDeposit} className="form-grid">
            <div className="form-group form-col-full">
              <label
                className="form-label"
                htmlFor="deposit-amount"
                title="Gas prefund held in EntryPoint. Agent requests pay fees from this."
              >
                ETH Amount to Deposit to EntryPoint
              </label>
              <input
                id="deposit-amount"
                type="text"
                className="form-input"
                placeholder="1.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
              />
              <span className="form-hint">
                Calls wallet.addDeposit() which pays EntryPoint.depositTo for UserOp gas reimbursement.
                Gas prefund held in EntryPoint — agent requests pay fees from this.
              </span>
            </div>

            <div className="form-col-full">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><span className="spinner" /> Depositing Gas…</> : "Add EntryPoint Deposit"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 5: AGENT MANAGEMENT */}
        {activeTab === "agent" && (
          <div className="form-grid">
            {policy?.isRevoked ? (
              <div className="banner banner-danger form-col-full">
                <span>AGENT IS CURRENTLY REVOKED (Agent = 0x0). All agent UserOps will fail.</span>
              </div>
            ) : (
              <div className="banner banner-success form-col-full">
                <span>Current Agent: {policy?.agent || CONTRACT_ADDRESSES.agent}</span>
              </div>
            )}

            {/* Revoke Agent Section */}
            <div className="agent-sub-card form-col-full">
              <h3 className="text-sm font-semibold text-red">Revoke Agent Key</h3>
              <p className="text-xs text-muted">
                Immediately revokes the agent by setting agent address to zero. All subsequent agent UserOps
                will be blocked immediately.
              </p>

              {confirmRevoke ? (
                <div className="confirm-box" style={{ marginTop: 12 }}>
                  <span className="text-xs text-red font-semibold">
                    Are you sure you want to revoke the agent key immediately?
                  </span>
                  <div className="confirm-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={isSubmitting}
                      onClick={handleRevokeAgent}
                    >
                      {isSubmitting ? <><span className="spinner" /> Revoking…</> : "Confirm Revoke"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmRevoke(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 12, alignSelf: "flex-start" }}
                  disabled={isSubmitting || Boolean(policy?.isRevoked)}
                  onClick={() => setConfirmRevoke(true)}
                >
                  Revoke Agent
                </button>
              )}
            </div>

            {/* Set / Restore Agent Section */}
            <form onSubmit={handleSetAgent} className="agent-sub-card form-col-full" style={{ marginTop: 0 }}>
              <h3 className="text-sm font-semibold">Set / Restore Agent Key</h3>
              <p className="text-xs text-muted">
                Assign an active agent key (e.g. Account #1 {CONTRACT_ADDRESSES.agent})
              </p>
              <div className="form-group" style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={newAgentAddress}
                  onChange={(e) => setNewAgentAddress(e.target.value.trim())}
                  required
                />
                {newAgentAddress && !isAddress(newAgentAddress) && (
                  <span className="form-error">⚠ Not a valid Ethereum address</span>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <><span className="spinner" /> Setting Agent…</> : "Set Agent Address"}
              </button>
            </form>
          </div>
        )}

        {/* Transaction Status Box */}
        {txStatus.status !== "idle" && (
          <div
            className={`tx-status-box tx-status-${txStatus.status}`}
            style={{ marginTop: 16 }}
          >
            <div className="tx-status-content">
              {txStatus.status === "pending" && <span className="spinner" />}
              {txStatus.status === "success" && <span className="icon">✓</span>}
              {txStatus.status === "error" && <span className="icon">✕</span>}
              <span className="tx-status-msg">
                {txStatus.message || txStatus.error}
              </span>
            </div>
            {txStatus.hash && (
              <span className="font-mono text-xs text-muted">
                Tx: {txStatus.hash}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
