import React from "react";
import { formatEther } from "viem";
import { WalletPolicy } from "../types";
import { CONTRACT_ADDRESSES, ZERO_ADDRESS } from "../constants";

interface StatusPanelProps {
  policy: WalletPolicy | null;
  isLoading: boolean;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ policy, isLoading }) => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  const isRevoked =
    !policy ||
    policy.agent.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    policy.agent === "0x0";

  const ethBalanceFormatted = policy
    ? parseFloat(formatEther(policy.ethBalance)).toFixed(4)
    : "0.0000";
  const perTxFormatted = policy ? formatEther(policy.perTxLimit) : "0";
  const dailyLimitFormatted = policy ? formatEther(policy.dailyLimit) : "0";
  const spentTodayFormatted = policy ? formatEther(policy.spentToday) : "0";

  // Spent today percentage calculation
  let progressPercent = 0;
  if (policy && policy.dailyLimit > 0n) {
    const rawPct = Number((policy.spentToday * 10000n) / policy.dailyLimit) / 100;
    progressPercent = Math.min(100, Math.max(0, rawPct));
  }

  // Format validUntil
  let validUntilDisplay = "No Policy Active";
  let isExpired = false;
  if (policy && policy.validUntil > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    const dateObj = new Date(policy.validUntil * 1000);
    validUntilDisplay = dateObj.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (policy.validUntil < nowSec) {
      isExpired = true;
      validUntilDisplay += " (Expired)";
    } else {
      const remainingHours = Math.round((policy.validUntil - nowSec) / 3600);
      if (remainingHours > 24) {
        validUntilDisplay += ` (${Math.round(remainingHours / 24)}d left)`;
      } else {
        validUntilDisplay += ` (${remainingHours}h left)`;
      }
    }
  }

  return (
    <section className="panel-card" aria-label="Wallet Status Panel">
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
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          Smart Wallet Status &amp; Policy
        </div>
        <div className="panel-badge">
          {isLoading ? "Syncing..." : "Auto-refreshes every 2s"}
        </div>
      </div>

      {/* Primary Key Stats Row */}
      <div className="stats-row">
        {/* Wallet Address & Balance */}
        <div className="stat-box">
          <div className="stat-label">
            <span>Wallet Balance</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
            >
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <div className="stat-value">
            {ethBalanceFormatted}
            <span className="stat-value-unit">ETH</span>
          </div>
          <div className="stat-subtext">
            <span className="address-chip mono">
              {CONTRACT_ADDRESSES.wallet.slice(0, 10)}...
              {CONTRACT_ADDRESSES.wallet.slice(-8)}
              <button
                className="copy-btn"
                onClick={() => handleCopy(CONTRACT_ADDRESSES.wallet, "wallet")}
                title="Copy full wallet address"
              >
                {copied === "wallet" ? "✓" : "📋"}
              </button>
            </span>
          </div>
        </div>

        {/* Agent Key Status */}
        <div className="stat-box">
          <div className="stat-label">
            <span>Agent Status</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isRevoked ? "#ef4444" : "#10b981"}
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m10 15 5-3-5-3v6Z" />
            </svg>
          </div>
          <div>
            {isRevoked ? (
              <span className="agent-badge-revoked">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" stroke="white" strokeWidth="2" />
                </svg>
                REVOKED
              </span>
            ) : (
              <span className="agent-badge-active">
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                ACTIVE KEY
              </span>
            )}
          </div>
          <div className="stat-subtext" style={{ marginTop: 4 }}>
            {isRevoked ? (
              <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>
                Zero address (Revoked by owner)
              </span>
            ) : (
              <span className="address-chip mono">
                {policy?.agent.slice(0, 8)}...{policy?.agent.slice(-6)}
                <button
                  className="copy-btn"
                  onClick={() => policy && handleCopy(policy.agent, "agent")}
                  title="Copy full agent address"
                >
                  {copied === "agent" ? "✓" : "📋"}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Per-Tx Limit */}
        <div className="stat-box">
          <div className="stat-label">
            <span>Per-Tx Limit</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-value">
            {perTxFormatted}
            <span className="stat-value-unit">ETH</span>
          </div>
          <div className="stat-subtext">Maximum spend per single call</div>
        </div>

        {/* Expiry Date */}
        <div className="stat-box">
          <div className="stat-label">
            <span>Policy Expiry</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: "1.1rem",
              color: isExpired ? "#f87171" : "#e2e8f0",
              lineHeight: 1.3,
            }}
          >
            {validUntilDisplay}
          </div>
          <div className="stat-subtext">
            {policy?.validUntil ? `Unix: ${policy.validUntil}` : "No expiry timestamp"}
          </div>
        </div>
      </div>

      {/* Spent Today Progress Card */}
      <div className="progress-card">
        <div className="progress-header">
          <div>
            <div className="progress-title">Daily Spending Limit Budget</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
              Resets every UTC midnight (Day #{Math.floor(Date.now() / 86400000)})
            </div>
          </div>
          <div className="progress-numbers mono">
            {spentTodayFormatted} / {dailyLimitFormatted} ETH
            <span
              style={{
                fontSize: "0.85rem",
                color: progressPercent >= 100 ? "#ef4444" : "var(--text-secondary)",
                marginLeft: 8,
              }}
            >
              ({progressPercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="progress-bar-bg" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`progress-bar-fill ${
              progressPercent >= 100
                ? "exceeded"
                : progressPercent >= 80
                ? "warning"
                : ""
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="progress-footer">
          <span>0 ETH</span>
          <span>50% Threshold</span>
          <span>Daily Cap: {dailyLimitFormatted} ETH</span>
        </div>
      </div>
    </section>
  );
};
