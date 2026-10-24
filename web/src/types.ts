export interface WalletPolicy {
  agent: `0x${string}`;
  isRevoked: boolean;
  perTxLimit: bigint;
  dailyLimit: bigint;
  validUntil: number;
  spentToday: bigint;
  ethBalance: bigint;
}

export type EventType =
  | "Executed"
  | "ApprovalSet"
  | "ApprovalUsed"
  | "RecipientSet"
  | "PolicyUpdated"
  | "AgentSet"
  | "AgentRevoked"
  | "CallAllowedSet";

export interface DashboardEvent {
  id: string;
  eventName: EventType;
  txHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp?: number;
  args: Record<string, any>;
  color: "green" | "blue" | "grey" | "red";
  isOwnerApproved?: boolean;
}

export interface TxStatus {
  status: "idle" | "pending" | "success" | "error";
  hash?: `0x${string}`;
  message?: string;
  error?: string;
}
