import React, { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { StickyNav } from "./components/StickyNav";
import { StatusPanel } from "./components/StatusPanel";
import { AgentSimulator } from "./components/AgentSimulator";
import { ActionForms } from "./components/ActionForms";
import { AttackLab } from "./components/AttackLab";
import { EventFeed } from "./components/EventFeed";
import { ToastContainer } from "./components/ToastContainer";
import { publicClient } from "./client";
import {
  CONTRACT_ADDRESSES,
  WALLET_ABI,
  ENTRY_POINT_ABI,
  ZERO_ADDRESS,
} from "./constants";
import { WalletPolicy, Toast, AgentAttempt } from "./types";

let toastId = 0;

export function App() {
  const [policy, setPolicy] = useState<WalletPolicy | null>(null);
  const [isAnvilConnected, setIsAnvilConnected] = useState<boolean>(true);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [attempts, setAttempts] = useState<AgentAttempt[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast helpers
  const addToast = useCallback((type: Toast["type"], title: string, message?: string) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const handleNewAttempt = useCallback((attempt: AgentAttempt) => {
    setAttempts((prev) => [attempt, ...prev]);
  }, []);

  // Fetch full contract state from Anvil
  const fetchContractState = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      // 1. Check RPC connection & current block number
      const currentBlock = await publicClient.getBlockNumber();
      const currentBlockData = await publicClient.getBlock({ blockNumber: currentBlock });
      setBlockNumber(currentBlock);
      setIsAnvilConnected(true);

      // 2. Check if code exists at the wallet address
      const code = await publicClient.getCode({ address: CONTRACT_ADDRESSES.wallet });
      const isDeployed = Boolean(code && code !== "0x" && code.length > 2);

      if (!isDeployed) {
        setPolicy({
          agent: ZERO_ADDRESS,
          isRevoked: false,
          perTxLimit: 0n,
          dailyLimit: 0n,
          validUntil: 0,
          spentToday: 0n,
          ethBalance: 0n,
          entryPointDeposit: 0n,
          dayNumber: 0,
          isDeployed: false,
          isAnvilOnline: true,
        });
        setIsLoading(false);
        if (isManual) setIsRefreshing(false);
        return;
      }

      // 3. Query policy view functions from SentinelWallet & EntryPoint
      const currentDayNumber = Math.floor(Number(currentBlockData.timestamp) / 86400);

      const [agentAddr, perTx, daily, validUntilSec, ethBal, epDeposit, spentTodayVal] =
        await Promise.all([
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
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.entryPoint,
            abi: ENTRY_POINT_ABI,
            functionName: "balanceOf",
            args: [CONTRACT_ADDRESSES.wallet],
          } as any) as Promise<bigint>,
          publicClient
            .readContract({
              address: CONTRACT_ADDRESSES.wallet,
              abi: WALLET_ABI,
              functionName: "spentOnDay",
              args: [BigInt(currentDayNumber)],
            } as any)
            .catch(() => 0n) as Promise<bigint>,
        ]);

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
        spentToday: BigInt(spentTodayVal || 0n),
        ethBalance: ethBal,
        entryPointDeposit: BigInt(epDeposit || 0n),
        dayNumber: currentDayNumber,
        isDeployed: true,
        isAnvilOnline: true,
      });
    } catch (err: any) {
      console.error("Anvil connection or read error:", err);
      setIsAnvilConnected(false);
      setPolicy((prev) =>
        prev
          ? { ...prev, isAnvilOnline: false }
          : {
              agent: ZERO_ADDRESS,
              isRevoked: false,
              perTxLimit: 0n,
              dailyLimit: 0n,
              validUntil: 0,
              spentToday: 0n,
              ethBalance: 0n,
              entryPointDeposit: 0n,
              dayNumber: 0,
              isDeployed: false,
              isAnvilOnline: false,
            }
      );
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Poll every 2 seconds
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
    <>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Sticky top bar */}
      <Header
        isAnvilConnected={isAnvilConnected}
        blockNumber={blockNumber}
        onRefresh={() => fetchContractState(true)}
        isRefreshing={isRefreshing}
      />

      {/* Sticky in-page nav */}
      <StickyNav />

      {/* Page wrapper */}
      <div className="app-container">
        <main className="main-content">
          {/* 1. Status Panel */}
          <section id="section-status">
            <StatusPanel policy={policy} isLoading={isLoading} />
          </section>

          {/* 2. Agent Simulator */}
          <section id="section-agent">
            <AgentSimulator
              attempts={attempts}
              onNewAttempt={handleNewAttempt}
              onRefreshPolicy={() => fetchContractState(true)}
              addToast={addToast}
            />
          </section>

          {/* 3. Owner Controls */}
          <section id="section-owner">
            <ActionForms
              policy={policy}
              onActionComplete={() => fetchContractState(true)}
              addToast={addToast}
            />
          </section>

          {/* 4. Attack Lab */}
          <section id="section-attack">
            <AttackLab
              dailyLimit={policy?.dailyLimit || 0n}
              spentToday={policy?.spentToday || 0n}
              onRefreshPolicy={() => fetchContractState(true)}
              onNewAttempt={handleNewAttempt}
              addToast={addToast}
            />
          </section>

          {/* 5. Event Feed */}
          <section id="section-feed">
            <EventFeed attempts={attempts} />
          </section>
        </main>
      </div>
    </>
  );
}
