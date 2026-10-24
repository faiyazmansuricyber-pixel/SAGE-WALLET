import React from "react";
import { CONTRACT_ADDRESSES } from "../constants";

interface HeaderProps {
  isAnvilConnected: boolean;
  blockNumber: bigint | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isAnvilConnected,
  blockNumber,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="brand-titles">
          <h1>Sentinel Wallet</h1>
          <p>Autonomous AI Agent Spending Policy &amp; Owner Control Center</p>
        </div>
      </div>

      <div className="header-meta">
        <div
          className={`network-badge ${isAnvilConnected ? "" : "offline"}`}
          title={isAnvilConnected ? "Anvil local node is reachable" : "Cannot reach Anvil at 127.0.0.1:8545"}
        >
          <span className={`pulse-dot ${isAnvilConnected ? "" : "offline"}`} />
          {isAnvilConnected ? "Anvil connected" : "Anvil offline"}
          {blockNumber !== null && (
            <span style={{ opacity: 0.75, marginLeft: 2 }}>
              #{blockNumber.toString()}
            </span>
          )}
        </div>

        <div
          className="demo-account-pill"
          title={`Anvil Demo Account #0 (Owner): ${CONTRACT_ADDRESSES.owner}`}
        >
          Owner: {CONTRACT_ADDRESSES.owner.slice(0, 6)}...
          {CONTRACT_ADDRESSES.owner.slice(-4)}
        </div>

        <button
          onClick={onRefresh}
          className="quick-btn"
          disabled={isRefreshing}
          title="Force refresh live contract state"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              animation: isRefreshing ? "spin 0.7s linear infinite" : "none",
            }}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          Sync
        </button>
      </div>
    </header>
  );
};
