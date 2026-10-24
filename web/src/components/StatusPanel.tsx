import React from "react";
import { WalletPolicy } from "../types";
import { CONTRACT_ADDRESSES, ZERO_ADDRESS, formatEth } from "../constants";

interface StatusPanelProps {
  policy: WalletPolicy | null;
  isLoading: boolean;
}

const SkeletonValue = () => (
  <span className="skeleton" style={{ width: "90px", height: "2.2rem", display: "inline-block" }} />
);

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

  const showSkeletons = isLoading && !policy;

  const ethBalanceFormatted = !isOfflineOrUndeployed && policy
    ? formatEth(policy.ethBalance, 4) : "-";
  const perTxFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.perTxLimit, 4) : "-";
  const dailyLimitFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.dailyLimit, 4) : "-";
  const spentTodayFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.spentToday, 4) : "-";
  const depositFormatted = !isOfflineOrUndeployed && policy ? formatEth(policy.entryPointDeposit, 4) : "-";

  let progressPercent = 0;
  if (!isOfflineOrUndeployed && policy && policy.dailyLimit > 0n) {
    const rawPct = Number((policy.spentToday * 10000n) / policy.dailyLimit) / 100;
    progressPercent = Math.min(100, Math.max(0, rawPct));
  }

  const getProgressBarClass = (): string => {
    if (progressPercent >= 90) return "fill-red";
    if (progressPercent >= 66) return "fill-amber";
    return "fill-green";
  };

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
      {/* Banners — keep shown even during reload per spec */}
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
          <span className="badge badge-purple text-xs">
            {isLoading ? (
              <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Syncing…</>
            ) : "Live: 2s auto-refresh"}
          </span>
        </div>
      </div>

      {/* Primary Key Stats Grid */}
      <div className="stats-grid">
        {/* Wallet Balance */}
        <div className="stat-card">
          <div className="stat-label">Wallet Balance</div>
          <div className="stat-value font-mono">
            {showSkeletons ? <SkeletonValue /> : (
              <>
                {ethBalanceFormatted}
                {ethBalanceFormatted !== "-" && (
                  <span className="stat-unit">ETH</span>
                )}
              </>
            )}
          </div>
          <div className="stat-subtext">
            <span
              className="address-chip font-mono"
              title={CONTRACT_ADDRESSES.wallet}
            >
              {CONTRACT_ADDRESSES.wallet.slice(0, 8)}...{CONTRACT_ADDRESSES.wallet.slice(-6)}
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(CONTRACT_ADDRESSES.wallet, "wallet")}
                title="Copy wallet address"
              >
                {copied === "wallet" ? "✓" : "⎘"}
              </button>
            </span>
          </div>
        </div>

        {/* Agent Status */}
        <div className="stat-card">
          <div className="stat-label" title="The delegated key that may send UserOps on your behalf">
            Agent Status
          </div>
          <div className="stat-value" style={{ fontSize: "1.1rem", paddingTop: 4 }}>
            {showSkeletons ? <SkeletonValue /> : (
              isOfflineOrUndeployed ? (
                <span className="text-muted">—</span>
              ) : isRevoked ? (
                <span className="badge badge-red badge-lg">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  Revoked
                </span>
              ) : (
                <span className="badge badge-green badge-lg">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  Active Key
                </span>
              )
            )}
          </div>
          <div className="stat-subtext font-mono">
            {isOfflineOrUndeployed ? "—" : isRevoked ? (
              <span className="text-red text-xs">Zero address (Revoked)</span>
            ) : (
              <span className="address-chip font-mono" title={policy?.agent}>
                {policy?.agent.slice(0, 8)}...{policy?.agent.slice(-6)}
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => policy && handleCopy(policy.agent, "agent")}
                  title="Copy agent address"
                >
                  {copied === "agent" ? "✓" : "⎘"}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Per-Tx Limit */}
        <div className="stat-card">
          <div
            className="stat-label"
            title="Maximum ETH the agent may spend in a single UserOperation"
          >
            Per-Tx Limit
          </div>
          <div className="stat-value font-mono">
            {showSkeletons ? <SkeletonValue /> : (
              <>
                {perTxFormatted}
                {perTxFormatted !== "-" && <span className="stat-unit">ETH</span>}
              </>
            )}
          </div>
          <div className="stat-subtext">Max spend per agent UserOp</div>
        </div>

        {/* EntryPoint Deposit */}
        <div className="stat-card">
          <div
            className="stat-label"
            title="Gas prefund held in EntryPoint. Agent requests pay fees from this."
          >
            EntryPoint Deposit
          </div>
          <div className="stat-value font-mono">
            {showSkeletons ? <SkeletonValue /> : (
              <>
                {depositFormatted}
                {depositFormatted !== "-" && <span className="stat-unit">ETH</span>}
              </>
            )}
          </div>
          <div className="stat-subtext">Gas prefund for UserOps</div>
        </div>

        {/* Policy Expiry */}
        <div className="stat-card stat-card-wide">
          <div className="stat-label" title="UTC-based timestamp after which the agent key is inactive">
            Policy Expiry
          </div>
          <div className={`stat-value font-mono text-sm ${isExpired ? "text-red" : ""}`}
            style={{ fontSize: "1rem", lineHeight: 1.5 }}>
            {showSkeletons ? <SkeletonValue /> : validUntilDisplay}
          </div>
          <div className="stat-subtext">
            {policy && policy.validUntil > 0
              ? `Unix: ${policy.validUntil}`
              : "No expiry timestamp"}
          </div>
        </div>
      </div>

      {/* Daily Budget Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <div>
            <span className="text-sm font-semibold">Daily Spending Budget</span>
            <span className="text-xs text-muted block" title="Resets at UTC midnight each day">
              Resets every UTC midnight
              {policy?.dayNumber ? ` (UTC Day #${policy.dayNumber})` : ""}
            </span>
          </div>
          <div className="progress-numbers">
            {spentTodayFormatted} / {dailyLimitFormatted} ETH
            {dailyLimitFormatted !== "-" && (
              <span
                style={{
                  marginLeft: 8,
                  color:
                    progressPercent >= 90
                      ? "var(--danger-text)"
                      : progressPercent >= 66
                      ? "var(--amber-text)"
                      : "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                ({progressPercent.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        <div
          className="progress-bar-bg"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`${progressPercent.toFixed(1)}% of daily limit used`}
        >
          <div
            className={`progress-bar-fill ${getProgressBarClass()}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="progress-footer">
          <span>0 ETH</span>
          <span>spent / cap — Daily Cap: {dailyLimitFormatted} ETH</span>
        </div>
      </div>
    </section>
  );
};
