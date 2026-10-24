import React, { useState } from "react";
import { parseEther, isAddress } from "viem";
import { walletClient, publicClient, ownerAccount } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI } from "../constants";
import { TxStatus } from "../types";

interface ActionFormsProps {
  onActionComplete: () => void;
}

type TabType = "policy" | "recipient" | "approve" | "deposit" | "revoke";

export const ActionForms: React.FC<ActionFormsProps> = ({ onActionComplete }) => {
  const [activeTab, setActiveTab] = useState<TabType>("policy");
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set Policy state
  const [perTxLimit, setPerTxLimit] = useState("0.5");
  const [dailyLimit, setDailyLimit] = useState("2.0");
  const [expiryHours, setExpiryHours] = useState("24");

  // Set Recipient state
  const [recipientAddress, setRecipientAddress] = useState<string>(
    CONTRACT_ADDRESSES.goodRecipient || ""
  );
  const [isRecipientAllowed, setIsRecipientAllowed] = useState(true);

  // Approve Call state
  const [approveTarget, setApproveTarget] = useState<string>(
    CONTRACT_ADDRESSES.goodRecipient || ""
  );
  const [approveValue, setApproveValue] = useState("0.1");
  const [approveExpiryMinutes, setApproveExpiryMinutes] = useState("30");

  // Add Deposit state
  const [depositAmount, setDepositAmount] = useState("1.0");

  // Revoke state
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Helper to extract revert reason
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

  // Helper to send transactions with status updates
  const executeTx = async (
    actionName: string,
    sendFn: () => Promise<`0x${string}`>
  ) => {
    setIsSubmitting(true);
    setTxStatus({
      status: "pending",
      message: `Broadcasting ${actionName} to Anvil...`,
    });

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
          message: `${actionName} confirmed successfully in block #${receipt.blockNumber}!`,
        });
        onActionComplete();
      } else {
        setTxStatus({
          status: "error",
          hash,
          error: `${actionName} reverted on chain.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setTxStatus({
        status: "error",
        error: parseRevertReason(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Set Policy
  const handleSetPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!perTxLimit || !dailyLimit || !expiryHours) return;

    try {
      const perTxWei = parseEther(perTxLimit);
      const dailyWei = parseEther(dailyLimit);
      const nowSec = Math.floor(Date.now() / 1000);
      const validUntilSec = nowSec + Math.max(1, Math.floor(parseFloat(expiryHours) * 3600));

      executeTx("Set Policy", () =>
        walletClient.writeContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "setPolicy",
          args: [perTxWei, dailyWei, validUntilSec],
          account: ownerAccount,
        })
      );
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.message || "Invalid input values" });
    }
  };

  // Handler: Set Recipient
  const handleSetRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(recipientAddress)) {
      setTxStatus({ status: "error", error: "Please enter a valid Ethereum address" });
      return;
    }

    executeTx(`Set Recipient (${isRecipientAllowed ? "Allow" : "Disallow"})`, () =>
      walletClient.writeContract({
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "setRecipient",
        args: [recipientAddress as `0x${string}`, isRecipientAllowed],
        account: ownerAccount,
      })
    );
  };

  // Handler: Approve Call (Target, value, empty 0x data, expiry in minutes)
  const handleApproveCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(approveTarget)) {
      setTxStatus({ status: "error", error: "Please enter a valid target address" });
      return;
    }

    try {
      const valueWei = parseEther(approveValue);
      const nowSec = Math.floor(Date.now() / 1000);
      const expirySec = nowSec + Math.max(1, Math.floor(parseFloat(approveExpiryMinutes) * 60));

      executeTx("Approve Call (One-Time Override)", () =>
        walletClient.writeContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "approveCall",
          args: [approveTarget as `0x${string}`, valueWei, "0x", expirySec],
          account: ownerAccount,
        })
      );
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.message || "Invalid input values" });
    }
  };

  // Handler: Add Deposit
  const handleAddDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const depositWei = parseEther(depositAmount);
      executeTx("Add Deposit to EntryPoint", () =>
        walletClient.writeContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "addDeposit",
          args: [],
          value: depositWei,
          account: ownerAccount,
        })
      );
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.message || "Invalid deposit amount" });
    }
  };

  // Handler: Revoke Agent
  const handleRevokeAgent = () => {
    setConfirmRevoke(false);
    executeTx("Revoke Agent", () =>
      walletClient.writeContract({
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "revokeAgent",
        args: [],
        account: ownerAccount,
      })
    );
  };

  return (
    <section className="panel-card" aria-label="Owner Actions">
      <div className="panel-title-bar">
        <div className="panel-title">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Owner Governance &amp; Controls
        </div>
        <div className="panel-badge">Signed by Anvil Account #0</div>
      </div>

      {/* Tabs */}
      <div className="action-tabs">
        <button
          className={`action-tab-btn ${activeTab === "policy" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("policy");
            setTxStatus({ status: "idle" });
          }}
        >
          Set Policy
        </button>
        <button
          className={`action-tab-btn ${activeTab === "recipient" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("recipient");
            setTxStatus({ status: "idle" });
          }}
        >
          Set Recipient
        </button>
        <button
          className={`action-tab-btn ${activeTab === "approve" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("approve");
            setTxStatus({ status: "idle" });
          }}
        >
          Approve Call
        </button>
        <button
          className={`action-tab-btn ${activeTab === "deposit" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("deposit");
            setTxStatus({ status: "idle" });
          }}
        >
          Add Deposit
        </button>
        <button
          className={`action-tab-btn ${activeTab === "revoke" ? "active" : ""}`}
          style={{
            color: activeTab === "revoke" ? "white" : "#f87171",
            background: activeTab === "revoke" ? "#dc2626" : undefined,
          }}
          onClick={() => {
            setActiveTab("revoke");
            setTxStatus({ status: "idle" });
          }}
        >
          Revoke Agent
        </button>
      </div>

      {/* Tab 1: Set Policy Form */}
      {activeTab === "policy" && (
        <form onSubmit={handleSetPolicy} className="form-body">
          <div className="form-group">
            <label className="form-label">
              <span>Per-Transaction Limit</span>
              <span className="form-label-desc">Max ETH per call</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={perTxLimit}
              onChange={(e) => setPerTxLimit(e.target.value)}
              className="form-input mono"
              placeholder="0.5"
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() => setPerTxLimit("0.25")}
              >
                0.25 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setPerTxLimit("0.5")}
              >
                0.5 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setPerTxLimit("1.0")}
              >
                1.0 ETH
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Daily Limit</span>
              <span className="form-label-desc">Max total ETH per UTC day</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="form-input mono"
              placeholder="2.0"
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDailyLimit("1.0")}
              >
                1.0 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDailyLimit("2.0")}
              >
                2.0 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDailyLimit("5.0")}
              >
                5.0 ETH
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Policy Expiry Duration</span>
              <span className="form-label-desc">Hours from now</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
              className="form-input mono"
              placeholder="24"
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() => setExpiryHours("6")}
              >
                +6 Hours
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setExpiryHours("24")}
              >
                +24 Hours
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setExpiryHours("168")}
              >
                +7 Days
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Broadcasting..." : "Save Policy (setPolicy)"}
          </button>
        </form>
      )}

      {/* Tab 2: Set Recipient Form */}
      {activeTab === "recipient" && (
        <form onSubmit={handleSetRecipient} className="form-body">
          <div className="form-group">
            <label className="form-label">
              <span>Recipient Address</span>
              <span className="form-label-desc">Target contract or merchant</span>
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="form-input mono"
              placeholder="0x..."
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() =>
                  setRecipientAddress(CONTRACT_ADDRESSES.goodRecipient || "")
                }
              >
                Use Good Recipient Demo
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Allowlist Status</span>
            </label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-option ${
                  isRecipientAllowed ? "active-allow" : ""
                }`}
                onClick={() => setIsRecipientAllowed(true)}
              >
                ✓ Allow Recipient (true)
              </button>
              <button
                type="button"
                className={`toggle-option ${
                  !isRecipientAllowed ? "active-disallow" : ""
                }`}
                onClick={() => setIsRecipientAllowed(false)}
              >
                ✕ Block Recipient (false)
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Broadcasting..." : "Update Recipient (setRecipient)"}
          </button>
        </form>
      )}

      {/* Tab 3: Approve Call Form */}
      {activeTab === "approve" && (
        <form onSubmit={handleApproveCall} className="form-body">
          <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
            Approve an out-of-policy single ETH transfer override without raising
            daily limits. Data is set to empty bytes (<code>0x</code>).
          </p>

          <div className="form-group">
            <label className="form-label">
              <span>Target Address</span>
              <span className="form-label-desc">Recipient of approved call</span>
            </label>
            <input
              type="text"
              value={approveTarget}
              onChange={(e) => setApproveTarget(e.target.value)}
              className="form-input mono"
              placeholder="0x..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Value (ETH)</span>
              <span className="form-label-desc">Amount to approve</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={approveValue}
              onChange={(e) => setApproveValue(e.target.value)}
              className="form-input mono"
              placeholder="0.1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Approval Expiry</span>
              <span className="form-label-desc">Minutes from now</span>
            </label>
            <input
              type="number"
              step="any"
              min="1"
              value={approveExpiryMinutes}
              onChange={(e) => setApproveExpiryMinutes(e.target.value)}
              className="form-input mono"
              placeholder="30"
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() => setApproveExpiryMinutes("10")}
              >
                10 mins
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setApproveExpiryMinutes("30")}
              >
                30 mins
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setApproveExpiryMinutes("60")}
              >
                60 mins
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Broadcasting..." : "Grant Approval (approveCall)"}
          </button>
        </form>
      )}

      {/* Tab 4: Add Deposit Form */}
      {activeTab === "deposit" && (
        <form onSubmit={handleAddDeposit} className="form-body">
          <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
            Deposits native ETH directly into the ERC-4337 EntryPoint contract on
            behalf of this wallet to pay for agent UserOp gas fees.
          </p>

          <div className="form-group">
            <label className="form-label">
              <span>Deposit Amount</span>
              <span className="form-label-desc">Payable ETH value</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="form-input mono"
              placeholder="1.0"
              required
            />
            <div className="quick-preset-row">
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDepositAmount("0.5")}
              >
                0.5 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDepositAmount("1.0")}
              >
                1.0 ETH
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => setDepositAmount("3.0")}
              >
                3.0 ETH
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Broadcasting..." : "Deposit to EntryPoint (addDeposit)"}
          </button>
        </form>
      )}

      {/* Tab 5: Revoke Agent */}
      {activeTab === "revoke" && (
        <div className="form-body">
          <p style={{ fontSize: "0.88rem", color: "#fca5a5", lineHeight: 1.5 }}>
            Revoking the agent key instantly clears the stored agent address to{" "}
            <code>0x0000000000000000000000000000000000000000</code>. Any further
            ERC-4337 UserOperations signed by the agent key will be rejected
            immediately.
          </p>

          {!confirmRevoke ? (
            <button
              type="button"
              className="submit-btn danger"
              onClick={() => setConfirmRevoke(true)}
              disabled={isSubmitting}
            >
              Initiate Agent Revocation (revokeAgent)
            </button>
          ) : (
            <div className="confirm-box">
              <div className="confirm-text">
                ⚠️ <strong>Confirm Emergency Revocation:</strong> Are you sure you
                want to revoke the agent? The agent key will be permanently
                deactivated until a new agent is configured.
              </div>
              <div className="confirm-btn-row">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setConfirmRevoke(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-btn danger"
                  onClick={handleRevokeAgent}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Revoking..." : "Yes, Revoke Agent Now"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Status & Hash Feedback */}
      {txStatus.status !== "idle" && (
        <div className={`feedback-box ${txStatus.status}`}>
          <div style={{ fontWeight: 600 }}>
            {txStatus.status === "pending" && "⏳ Processing Transaction"}
            {txStatus.status === "success" && "✓ Transaction Confirmed"}
            {txStatus.status === "error" && "✕ Transaction Failed"}
          </div>
          {txStatus.message && <div>{txStatus.message}</div>}
          {txStatus.error && (
            <div style={{ color: "#f87171", fontFamily: "JetBrains Mono" }}>
              {txStatus.error}
            </div>
          )}
          {txStatus.hash && (
            <div className="feedback-hash mono">
              <span>Tx Hash:</span>
              <span>{txStatus.hash}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
