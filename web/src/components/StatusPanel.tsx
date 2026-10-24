import React from "react";
import { WalletPolicy } from "../types";
import { CONTRACT_ADDRESSES, ZERO_ADDRESS, formatEth } from "../constants";

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

  const isAnvilOffline = policy ? !policy.isAnvilOnline : false;
  const isUndeployed = policy ? !policy.isDeployed : false;
  const isOfflineOrUndeployed = isAnvilOffline || isUndeployed;

  const isRevoked =
    policy?.isDeployed &&
    (policy.isRevoked ||
      policy.agent.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
      policy.agent === "0x0");

  const ethBalanceFormatted = !isOfflineOrUndeployed && policy
    ? formatEth(policy.ethBalance, 4)
    : "-";
  const perTxFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.perTxLimit, 4) : "-";
  const dailyLimitFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.dailyLimit, 4) : "-";
  const spentTodayFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.spentToday, 4) : "-";
  const depositFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.entryPointDeposit, 4) : "-";

  // Spent today percentage calculation
  let progressPercent = 0;
  if (!isOfflineOrUndeployed && policy && policy.dailyLimit > 0n) {
    const rawPct = Number((policy.spentToday * 10000n) / policy.dailyLimit) / 100;
    progressPercent = Math.min(100, Math.max(0, rawPct));
  }

  // Progress bar class: amber above 70%, red at 100%
  const getProgressBarClass = (): string => {
    if (progressPercent >= 100) return "fill-red";
    if (progressPercent >= 70) return "fill-amber";
    return "fill-green";
  };

  // Format validUntil
  let validUntilDisplay = "-";
  let isExpired = false;
  if (!isOfflineOrUndeployed && policy) {
    if (policy.validUntil > 0) {
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
    } else {
      validUntilDisplay = "No Policy Active";
    }
  }

  return (
    <section className="dashboard-card status-panel-card" aria-label="Wallet Status Panel">
      {/* Banner for Connection or Deploy Issue */}
      {isAnvilOffline && (
        <div className="banner banner-danger" id="anvil-offline-banner">
          <span className="banner-icon">⚠️</span>
          <span>Anvil offline. Ensure http://127.0.0.1:8545 is accessible.</span>
        </div>
      )}

      {!isAnvilOffline && isUndeployed && (
        <div className="banner banner-danger" id="wallet-undeployed-banner">
          <span className="banner-icon">⚠️</span>
          <span>Wallet not deployed at {CONTRACT_ADDRESSES.wallet}. Re-run the deploy script.</span>
        </div>
      )}

      {/* Gas deposit warning if deposit is 0 */}
      {!isOfflineOrUndeployed && policy && policy.entryPointDeposit === 0n && (
        <div className="banner banner-warning" id="zero-deposit-banner">
          <span className="banner-icon">⚠️</span>
          <span>Agent requests will fail: no gas deposit. Deposit ETH to EntryPoint below.</span>
        </div>
      )}

      <div className="card-header">
        <div className="panel-title-group">
          <h2 className="card-title">Sentinel Wallet Status &amp; Policy</h2>
          <span className="text-xs text-muted">
            ERC-4337 Smart Account under owner spending rules
          </span>
        </div>
        <div className="header-badges">
          <span className="badge badge-purple font-mono text-xs">
            {isLoading ? "Syncing..." : "Live: 2s auto-refresh"}
          </span>
        </div>
      </div>

      {/* Primary Key Stats Grid */}
      <div className="stats-grid">
        {/* Wallet Address & Balance */}
        <div className="stat-card">
          <div className="stat-label">Wallet Balance</div>
          <div className="stat-value font-mono">
            {ethBalanceFormatted} {ethBalanceFormatted !== "-" && <span className="stat-unit">ETH</span>}
          </div>
          <div className="stat-subtext">
            <span className="address-chip font-mono">
              {CONTRACT_ADDRESSES.wallet.slice(0, 8)}...{CONTRACT_ADDRESSES.wallet.slice(-6)}
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(CONTRACT_ADDRESSES.wallet, "wallet")}
                title="Copy address"
              >
                {copied === "wallet" ? "✓" : "📋"}
              </button>
            </span>
          </div>
        </div>

        {/* Agent Key Status */}
        <div className="stat-card">
          <div className="stat-label">Agent Status</div>
          <div className="stat-value">
            {isOfflineOrUndeployed ? (
              "-"
            ) : isRevoked ? (
              <span className="badge badge-red">REVOKED</span>
            ) : (
              <span className="badge badge-green">ACTIVE KEY</span>
            )}
          </div>
          <div className="stat-subtext font-mono">
            {isOfflineOrUndeployed ? (
              "-"
            ) : isRevoked ? (
              <span className="text-red text-xs">Zero address (Revoked)</span>
            ) : (
              <span className="address-chip font-mono">
                {policy?.agent.slice(0, 8)}...{policy?.agent.slice(-6)}
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => policy && handleCopy(policy.agent, "agent")}
                  title="Copy agent address"
                >
                  {copied === "agent" ? "✓" : "📋"}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Per-Tx Limit */}
        <div className="stat-card">
          <div className="stat-label">Per-Tx Limit</div>
          <div className="stat-value font-mono">
            {perTxFormatted} {perTxFormatted !== "-" && <span className="stat-unit">ETH</span>}
          </div>
          <div className="stat-subtext">Max spend per agent UserOp</div>
        </div>

        {/* EntryPoint Deposit */}
        <div className="stat-card">
          <div className="stat-label">EntryPoint Deposit</div>
          <div className="stat-value font-mono">
            {depositFormatted} {depositFormatted !== "-" && <span className="stat-unit">ETH</span>}
          </div>
          <div className="stat-subtext">Gas prefund for UserOps</div>
        </div>

        {/* Policy Expiry */}
        <div className="stat-card stat-card-wide">
          <div className="stat-label">Policy Expiry</div>
          <div className={`stat-value font-mono text-sm ${isExpired ? "text-red" : ""}`}>
            {validUntilDisplay}
          </div>
          <div className="stat-subtext">
            {policy && policy.validUntil > 0 ? `Unix: ${policy.validUntil}` : "No expiry timestamp"}
          </div>
        </div>
      </div>

      {/* Spent Today Progress Card */}
      <div className="progress-section">
        <div className="progress-header">
          <div>
            <span className="text-sm font-semibold">Daily Spending Limit Budget</span>
            <span className="text-xs text-muted block">
              Resets every UTC midnight {policy?.dayNumber ? `(UTC Day #${policy.dayNumber})` : ""}
            </span>
          </div>
          <div className="progress-numbers font-mono text-sm">
            {spentTodayFormatted} / {dailyLimitFormatted} ETH
            {dailyLimitFormatted !== "-" && (
              <span
                style={{
                  fontSize: "0.85rem",
                  color:
                    progressPercent >= 100
                      ? "#ef4444"
                      : progressPercent >= 70
                      ? "#f59e0b"
                      : "var(--text-secondary)",
                  marginLeft: 8,
                }}
              >
                ({progressPercent.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        <div className="progress-bar-bg" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`progress-bar-fill ${getProgressBarClass()}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="progress-footer text-xs text-muted">
          <span>0 ETH</span>
          <span>Daily Cap: {dailyLimitFormatted} ETH</span>
        </div>
      </div>
    </section>
  );
};
