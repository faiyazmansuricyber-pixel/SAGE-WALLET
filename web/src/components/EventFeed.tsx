import React, { useEffect, useState, useRef } from "react";
import { formatEther } from "viem";
import { publicClient } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI } from "../constants";
import { DashboardEvent, EventType } from "../types";

const getColorForEvent = (name: string): "green" | "blue" | "grey" | "red" => {
  switch (name) {
    case "Executed":
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
    default:
      return "grey";
  }
};

export const EventFeed: React.FC = () => {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const blockTimeCache = useRef<Map<string, number>>(new Map());

  // Helper to fetch block timestamp with caching
  const getBlockTime = async (blockNumber: bigint): Promise<number | undefined> => {
    const key = blockNumber.toString();
    if (blockTimeCache.current.has(key)) {
      return blockTimeCache.current.get(key);
    }
    try {
      const block = await publicClient.getBlock({ blockNumber });
      const time = Number(block.timestamp);
      blockTimeCache.current.set(key, time);
      return time;
    } catch {
      return undefined;
    }
  };

  // Convert viem log to DashboardEvent
  const parseLog = async (log: any): Promise<DashboardEvent> => {
    const eventName = log.eventName as EventType;
    const color = getColorForEvent(eventName);
    const isOwnerApproved =
      eventName === "Executed" && Boolean(log.args?.approved);

    const blockTimestamp = log.blockNumber
      ? await getBlockTime(log.blockNumber)
      : undefined;

    return {
      id: `${log.transactionHash}-${log.logIndex ?? 0}`,
      eventName,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber ?? 0n,
      blockTimestamp,
      args: log.args || {},
      color,
      isOwnerApproved,
    };
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch initial past logs from block 0
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
          // Sort newest first
          parsedList.sort((a, b) => {
            if (b.blockNumber !== a.blockNumber) {
              return b.blockNumber > a.blockNumber ? 1 : -1;
            }
            return 0;
          });
          setEvents(parsedList);
        }
      } catch (err) {
        console.error("Failed to fetch past events:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistoricalEvents();

    // 2. Watch for live contract events via viem watchContractEvent
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESSES.wallet,
      abi: WALLET_ABI,
      onLogs: async (newLogs) => {
        for (const log of newLogs) {
          const parsed = await parseLog(log);
          if (isMounted) {
            setEvents((prev) => {
              if (prev.some((e) => e.id === parsed.id)) return prev;
              return [parsed, ...prev];
            });
          }
        }
      },
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  const formatTimestamp = (sec?: number) => {
    if (!sec) return "Just now";
    return new Date(sec * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <section className="panel-card" aria-label="Live Event Feed">
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Live Contract Event Feed
        </div>
        <div className="panel-badge">
          {events.length} {events.length === 1 ? "Event" : "Events"} recorded
        </div>
      </div>

      <div className="events-container">
        {isLoading && (
          <div className="empty-events">Scanning event history from Block 0...</div>
        )}

        {!isLoading && events.length === 0 && (
          <div className="empty-events">
            No events found yet. Execute an owner transaction or trigger an agent
            action to view live logs.
          </div>
        )}

        {events.map((ev) => (
          <div key={ev.id} className={`event-card ${ev.color}`}>
            <div className="event-card-header">
              <div className={`event-name-tag ${ev.color}`}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "currentColor",
                  }}
                />
                {ev.eventName}
                {ev.isOwnerApproved && (
                  <span className="approved-badge">Owner-Approved</span>
                )}
              </div>

              <div className="event-meta mono">
                <span>{formatTimestamp(ev.blockTimestamp)}</span>
                <span>Block #{ev.blockNumber.toString()}</span>
              </div>
            </div>

            {/* Event Specific Parameters */}
            <div className="event-details mono">
              {/* Executed Event Details */}
              {ev.eventName === "Executed" && (
                <>
                  <div className="event-detail-item">
                    <span className="detail-label">Target Recipient</span>
                    <span className="detail-value">
                      {ev.args.target
                        ? `${ev.args.target.slice(0, 8)}...${ev.args.target.slice(-6)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Value</span>
                    <span className="detail-value" style={{ color: "#34d399" }}>
                      {ev.args.value !== undefined
                        ? `${formatEther(BigInt(ev.args.value))} ETH`
                        : "0 ETH"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Selector</span>
                    <span className="detail-value">
                      {ev.args.selector || "0x00000000"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Approved</span>
                    <span className="detail-value">
                      {ev.args.approved ? "True" : "False"}
                    </span>
                  </div>
                </>
              )}

              {/* PolicyUpdated Event Details */}
              {ev.eventName === "PolicyUpdated" && (
                <>
                  <div className="event-detail-item">
                    <span className="detail-label">Per-Tx Limit</span>
                    <span className="detail-value">
                      {ev.args.perTxLimit !== undefined
                        ? `${formatEther(BigInt(ev.args.perTxLimit))} ETH`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Daily Limit</span>
                    <span className="detail-value">
                      {ev.args.dailyLimit !== undefined
                        ? `${formatEther(BigInt(ev.args.dailyLimit))} ETH`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Valid Until</span>
                    <span className="detail-value">
                      {ev.args.validUntil
                        ? new Date(Number(ev.args.validUntil) * 1000).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </>
              )}

              {/* ApprovalSet Event Details */}
              {ev.eventName === "ApprovalSet" && (
                <>
                  <div className="event-detail-item">
                    <span className="detail-label">Call Hash</span>
                    <span className="detail-value">
                      {ev.args.callHash
                        ? `${ev.args.callHash.slice(0, 10)}...${ev.args.callHash.slice(-8)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Expiry</span>
                    <span className="detail-value">
                      {ev.args.expiry
                        ? new Date(Number(ev.args.expiry) * 1000).toLocaleTimeString()
                        : "N/A"}
                    </span>
                  </div>
                </>
              )}

              {/* ApprovalUsed Event Details */}
              {ev.eventName === "ApprovalUsed" && (
                <div className="event-detail-item">
                  <span className="detail-label">Used Call Hash</span>
                  <span className="detail-value">
                    {ev.args.callHash
                      ? `${ev.args.callHash.slice(0, 14)}...${ev.args.callHash.slice(-10)}`
                      : "N/A"}
                  </span>
                </div>
              )}

              {/* RecipientSet Event Details */}
              {ev.eventName === "RecipientSet" && (
                <>
                  <div className="event-detail-item">
                    <span className="detail-label">Recipient</span>
                    <span className="detail-value">
                      {ev.args.recipient
                        ? `${ev.args.recipient.slice(0, 10)}...${ev.args.recipient.slice(-8)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="event-detail-item">
                    <span className="detail-label">Allowed</span>
                    <span
                      className="detail-value"
                      style={{
                        color: ev.args.allowed ? "#34d399" : "#f87171",
                      }}
                    >
                      {ev.args.allowed ? "TRUE (Allowlisted)" : "FALSE (Blocked)"}
                    </span>
                  </div>
                </>
              )}

              {/* AgentSet Event Details */}
              {ev.eventName === "AgentSet" && (
                <div className="event-detail-item">
                  <span className="detail-label">New Agent</span>
                  <span className="detail-value">
                    {ev.args.agent
                      ? `${ev.args.agent.slice(0, 10)}...${ev.args.agent.slice(-8)}`
                      : "N/A"}
                  </span>
                </div>
              )}

              {/* AgentRevoked Event Details */}
              {ev.eventName === "AgentRevoked" && (
                <div className="event-detail-item">
                  <span className="detail-label">Revoked Agent Address</span>
                  <span className="detail-value" style={{ color: "#f87171" }}>
                    {ev.args.agent || "Agent Key Revoked"}
                  </span>
                </div>
              )}

              {/* Tx Hash Link */}
              <div className="event-detail-item">
                <span className="detail-label">Transaction Hash</span>
                <span className="detail-value" style={{ opacity: 0.8 }}>
                  {ev.txHash ? `${ev.txHash.slice(0, 8)}...${ev.txHash.slice(-6)}` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
