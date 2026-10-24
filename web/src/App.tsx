import React, { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { StatusPanel } from "./components/StatusPanel";
import { ActionForms } from "./components/ActionForms";
import { EventFeed } from "./components/EventFeed";
import { publicClient } from "./client";
import { CONTRACT_ADDRESSES, WALLET_ABI, ZERO_ADDRESS, ANVIL_RPC_URL } from "./constants";
import { WalletPolicy } from "./types";

export function App() {
  const [policy, setPolicy] = useState<WalletPolicy | null>(null);
  const [isAnvilConnected, setIsAnvilConnected] = useState<boolean>(true);
  const [anvilError, setAnvilError] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch full contract state from Anvil
  const fetchContractState = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      // 1. Check RPC connection & current block number
      const currentBlock = await publicClient.getBlockNumber();
      setBlockNumber(currentBlock);
      setIsAnvilConnected(true);
      setAnvilError(null);

      // 2. Query policy view functions from SentinelWallet
      const [agentAddr, perTx, daily, validUntilSec, ethBal] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "agent",
          args: [],
        } as any) as Promise<`0x${string}`>,
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "perTxLimit",
          args: [],
        } as any) as Promise<bigint>,
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "dailyLimit",
          args: [],
        } as any) as Promise<bigint>,
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "validUntil",
          args: [],
        } as any) as Promise<number | bigint>,
        publicClient.getBalance({
          address: CONTRACT_ADDRESSES.wallet,
        }),
      ]);

      // 3. Query spent today: spentOnDay(floor(now / 86400))
      // 1 day = 86400 seconds (86400000 ms)
      const currentDay = BigInt(Math.floor(Date.now() / 86400000));
      let spent = 0n;
      try {
        const rawSpent = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          functionName: "spentOnDay",
          args: [currentDay],
        });
        spent = BigInt(rawSpent as any);
      } catch {
        spent = 0n;
      }

      const agentString = String(agentAddr || "");
      const isRevoked =
        !agentString ||
        agentString.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
        agentString === "0x0";

      setPolicy({
        agent: (agentAddr || ZERO_ADDRESS) as `0x${string}`,
        isRevoked,
        perTxLimit: BigInt(perTx),
        dailyLimit: BigInt(daily),
        validUntil: Number(validUntilSec),
        spentToday: spent,
        ethBalance: ethBal,
      });
    } catch (err: any) {
      console.error("Anvil connection or read error:", err);
      setIsAnvilConnected(false);
      setAnvilError(
        `Unable to connect to Anvil RPC node at ${ANVIL_RPC_URL}. Please ensure Anvil is running locally: anvil --code-size-limit 50000`
      );
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Poll every 2 seconds as required by specification
  useEffect(() => {
    fetchContractState();

    refreshTimerRef.current = setInterval(() => {
      fetchContractState();
    }, 2000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchContractState]);

  return (
    <div className="app-container">
      {/* Header bar */}
      <Header
        isAnvilConnected={isAnvilConnected}
        blockNumber={blockNumber}
        onRefresh={() => fetchContractState(true)}
        isRefreshing={isRefreshing}
      />

      {/* Anvil Offline Alert Banner */}
      {!isAnvilConnected && anvilError && (
        <div className="error-banner" role="alert">
          <div className="error-banner-content">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Anvil Connection Error:</strong> {anvilError}
            </div>
          </div>
          <button
            onClick={() => fetchContractState(true)}
            className="quick-btn"
            style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Section 1: Policy & Status Panel */}
      <StatusPanel policy={policy} isLoading={isLoading} />

      {/* Section 2 & 3: Owner Actions and Live Event Feed */}
      <div className="dashboard-grid">
        <ActionForms onActionComplete={() => fetchContractState(true)} />
        <EventFeed />
      </div>
    </div>
  );
}

export default App;
