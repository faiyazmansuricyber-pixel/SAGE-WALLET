import React, { useEffect, useState, useRef } from "react";
import { publicClient } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI, formatEth } from "../constants";
import { DashboardEvent, EventType, EventFilter, AgentAttempt } from "../types";

interface EventFeedProps {
  attempts?: AgentAttempt[];
}

const getColorForEvent = (name: string): "green" | "blue" | "amber" | "grey" | "red" => {
  switch (name) {
    case "Executed":
    case "AgentExecuted":
      return "green";
    case "ApprovalSet":
    case "ApprovalUsed":
      return "blue";
    case "AgentRevoked":
      return "red";
    case "PolicyUpdated":
    case "RecipientSet":
    case "AgentSet":
    case "CallAllowedSet":
      return "amber";
    default:
      return "grey";
  }
};

export const EventFeed: React.FC<EventFeedProps> = ({ attempts = [] }) => {
  const [onchainEvents, setOnchainEvents] = useState<DashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<EventFilter>("All");
  const blockTimeCache = useRef<Map<string, number>>(new Map());

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getBlockTime = async (blockNumber: bigint): Promise<number> => {
    const key = blockNumber.toString();
    if (blockTimeCache.current.has(key)) return blockTimeCache.current.get(key)!;
    try {
      const block = await publicClient.getBlock({ blockNumber });
      const time = Number(block.timestamp);
      blockTimeCache.current.set(key, time);
      return time;
    } catch {
      const cur = await publicClient.getBlock();
      return Number(cur.timestamp);
    }
  };

  const parseLog = async (log: any): Promise<DashboardEvent> => {
    const eventName = log.eventName as EventType;
    const color = getColorForEvent(eventName);

    const blockTimestamp = log.blockNumber
      ? await getBlockTime(log.blockNumber)
      : Number((await publicClient.getBlock()).timestamp);

    let summary = `${eventName} emitted`;
    if (eventName === "Executed" || eventName === "AgentExecuted") {
      const targetRaw = String(log.args?.target || log.args?.[0] || "");
      const shortTgt = targetRaw && targetRaw.length >= 10
        ? `${targetRaw.slice(0, 6)}...${targetRaw.slice(-4)}`
        : targetRaw;
      const approvedBadge = log.args?.approved ? " (owner-approved)" : "";
      summary = `Agent executed ${formatEth(log.args?.value || 0n, 4)} ETH to ${shortTgt}${approvedBadge}`;
    } else if (eventName === "ApprovalSet") {
      summary = `Owner approved callHash ${String(log.args?.callHash || "").slice(0, 10)}...`;
    } else if (eventName === "ApprovalUsed") {
      summary = `Approved call executed by agent (callHash: ${String(log.args?.callHash || "").slice(0, 10)}...)`;
    } else if (eventName === "AgentRevoked") {
      const oldAgent = String(log.args?.agent || log.args?.[0] || "");
      const shortAddr = oldAgent && oldAgent.length >= 10
        ? ` (${oldAgent.slice(0, 6)}...${oldAgent.slice(-4)})` : "";
      summary = `Agent key REVOKED by owner${shortAddr}`;
    } else if (eventName === "AgentSet") {
      const agentRaw = String(log.args?.agent || log.args?.[0] || "");
      const shortAddr = agentRaw && agentRaw.length >= 10
        ? `${agentRaw.slice(0, 6)}...${agentRaw.slice(-4)}`
        : agentRaw || "unknown";
      summary = `New agent assigned: ${shortAddr}`;
    } else if (eventName === "RecipientSet") {
      const rec = String(log.args?.recipient || log.args?.[0] || "");
      const shortRec = rec && rec.length >= 10 ? `${rec.slice(0, 6)}...${rec.slice(-4)}` : rec;
      summary = `Recipient ${shortRec} ${log.args?.allowed ? "allowed" : "disallowed"}`;
    } else if (eventName === "PolicyUpdated") {
      summary = `Policy updated: perTx ${formatEth(log.args?.perTxLimit || 0n, 4)} ETH, daily ${formatEth(log.args?.dailyLimit || 0n, 4)} ETH`;
    }

    return {
      id: `${log.transactionHash}-${log.logIndex ?? 0}`,
      eventName,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber ?? 0n,
      blockTimestamp,
      args: log.args || {},
      color,
      summary,
      isOffchain: false,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const fetchHistoricalEvents = async () => {
      setIsLoading(true);
      try {
        const rawLogs = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESSES.wallet,
          abi: WALLET_ABI,
          fromBlock: 0n,
        });

        const parsedList: DashboardEvent[] = [];
        for (const log of rawLogs) {
          const parsed = await parseLog(log);
          parsedList.push(parsed);
        }

        if (isMounted) {
          parsedList.sort((a, b) => {
            if (b.blockNumber && a.blockNumber && b.blockNumber !== a.blockNumber) {
              return b.blockNumber > a.blockNumber ? 1 : -1;
            }
            return (b.blockTimestamp || 0) - (a.blockTimestamp || 0);
          });
          setOnchainEvents(parsedList);
        }
      } catch (err) {
        console.error("Failed to fetch past events:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistoricalEvents();

    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESSES.wallet,
      abi: WALLET_ABI,
      onLogs: async (logs) => {
        for (const log of logs) {
          const parsed = await parseLog(log);
          if (isMounted) {
            setOnchainEvents((prev) => [parsed, ...prev.filter((e) => e.id !== parsed.id)]);
          }
        }
      },
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  // Convert off-chain attempts into DashboardEvent representations
  const offchainEvents: DashboardEvent[] = attempts.map((att) => {
    const tgt = att.target.length >= 10 ? `${att.target.slice(0, 6)}...${att.target.slice(-4)}` : att.target;
    return {
      id: `attempt-${att.id}`,
      eventName: "AgentAttemptOffchain",
      txHash: att.txHash,
      blockTimestamp: Math.floor(att.timestamp / 1000),
      args: {
        target: att.target,
        value: att.value,
        reason: att.reason,
        status: att.status,
        userOpHash: att.userOpHash,
      },
      color: att.status === "EXECUTED" ? "green" : "red",
      summary:
        att.status === "EXECUTED"
          ? `Agent request executed: ${formatEth(att.value, 4)} ETH to ${tgt}`
          : `Agent request BLOCKED: ${att.reason || "Reverted"} (${formatEth(att.value, 4)} ETH to ${tgt})`,
      isOffchain: true,
    };
  });

  // Merge on-chain and off-chain events chronologically
  const mergedEvents = [...onchainEvents, ...offchainEvents].sort((a, b) => {
    const timeA = a.blockTimestamp || 0;
    const timeB = b.blockTimestamp || 0;
    return timeB - timeA;
  });

  // Filter items
  const filteredEvents = mergedEvents.filter((ev) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Executed") {
      return (
        ev.eventName === "Executed" ||
        ev.eventName === "AgentExecuted" ||
        (ev.isOffchain && ev.args?.status === "EXECUTED")
      );
    }
    if (activeFilter === "Approvals") {
      return ev.eventName === "ApprovalSet" || ev.eventName === "ApprovalUsed";
    }
    if (activeFilter === "Policy") {
      return (
        ev.eventName === "PolicyUpdated" ||
        ev.eventName === "RecipientSet" ||
        ev.eventName === "AgentSet" ||
        ev.eventName === "AgentRevoked"
      );
    }
    return true;
  });

  // Count per filter for chip counts
  const countFor = (filter: EventFilter): number => {
    if (filter === "All") return mergedEvents.length;
    return mergedEvents.filter((ev) => {
      if (filter === "Executed") return ev.eventName === "Executed" || ev.eventName === "AgentExecuted" || (ev.isOffchain && ev.args?.status === "EXECUTED");
      if (filter === "Approvals") return ev.eventName === "ApprovalSet" || ev.eventName === "ApprovalUsed";
      if (filter === "Policy") return ev.eventName === "PolicyUpdated" || ev.eventName === "RecipientSet" || ev.eventName === "AgentSet" || ev.eventName === "AgentRevoked";
      return true;
    }).length;
  };

  const abiFunctionNames = new Set(
    (WALLET_ABI as Array<{ name?: string }>).map((x) => x.name).filter(Boolean)
  );
  const phase2Features = [
    { name: "Emergency Wallet Freeze", fn: "freeze" },
    { name: "Guardian Social Recovery", fn: "guardians" },
    { name: "Paymaster Gas Quota", fn: "sponsorQuota" },
    { name: "Fuzz / invariant tests (not built yet)", fn: "proposeRecovery" },
  ];

  return (
    <section className="dashboard-card event-feed-panel" id="event-feed">
      <div className="card-header">
        <div>
          <h2 className="card-title">Live Wallet &amp; Agent Feed</h2>
          <p className="card-subtitle">
            Unified chronological stream of on-chain contract events and off-chain agent validation attempts
          </p>
        </div>
        <div className="filter-chips">
          {(["All", "Executed", "Approvals", "Policy"] as EventFilter[]).map((filter) => (
            <button
              type="button"
              key={filter}
              className={`chip ${activeFilter === filter ? "active" : ""}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
              {!isLoading && (
                <span style={{
                  marginLeft: 4,
                  fontSize: "0.7rem",
                  opacity: 0.75,
                  fontWeight: 700,
                }}>
                  {countFor(filter)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="event-list-wrapper">
        {isLoading && mergedEvents.length === 0 ? (
          <div className="loading-state">
            <span className="spinner" /> Syncing event logs…
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">No events matching this filter.</div>
        ) : (
          <div className="event-list">
            {filteredEvents.map((ev) => (
              <div key={ev.id} className={`event-item event-color-${ev.color}`}>
                <div className="event-item-top">
                  <div className="event-item-left">
                    <span className={`badge badge-${ev.color}`}>
                      {ev.isOffchain ? "AGENT OP" : ev.eventName}
                    </span>
                    {ev.isOffchain && (
                      <span className="badge badge-grey badge-xs">
                        off-chain
                      </span>
                    )}
                  </div>
                  <span className="event-time text-xs text-muted font-mono">
                    {ev.blockTimestamp
                      ? new Date(ev.blockTimestamp * 1000).toLocaleTimeString()
                      : "Pending"}
                  </span>
                </div>

                <div className="event-summary text-sm font-semibold">{ev.summary}</div>

                <div className="event-meta text-xs text-muted font-mono">
                  {ev.txHash && (
                    <span>
                      tx: {ev.txHash.slice(0, 10)}...{ev.txHash.slice(-4)}
                      <button
                        className="copy-btn"
                        style={{ marginLeft: 4 }}
                        onClick={() => ev.txHash && handleCopy(ev.txHash, `tx-${ev.id}`)}
                        title="Copy tx hash"
                      >
                        {copiedId === `tx-${ev.id}` ? "✓" : "⎘"}
                      </button>
                    </span>
                  )}
                  {ev.blockNumber ? <span>block: #{ev.blockNumber.toString()}</span> : null}
                  {ev.args?.userOpHash && (
                    <span>
                      opHash: {String(ev.args.userOpHash).slice(0, 8)}...
                      <button
                        className="copy-btn"
                        style={{ marginLeft: 4 }}
                        onClick={() => handleCopy(String(ev.args.userOpHash), `op-${ev.id}`)}
                        title="Copy userOp hash"
                      >
                        {copiedId === `op-${ev.id}` ? "✓" : "⎘"}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STAGE 5: Coming Next Section */}
      <div className="coming-next-section">
        <h3 className="section-subtitle">Coming Next (Phase 2 Architecture)</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
          Introspected on-chain capability check against SentinelWallet ABI:
        </p>
        <div className="coming-next-grid">
          {phase2Features.map((feat) => {
            const isDeployed = abiFunctionNames.has(feat.fn);
            return (
              <div key={feat.name} className="coming-next-card">
                <span className="text-sm font-semibold">{feat.name}</span>
                <span className={`badge badge-xs ${isDeployed ? "badge-green" : "badge-grey"}`}>
                  {isDeployed ? "Active on contract" : "Not deployed on the contract yet"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
