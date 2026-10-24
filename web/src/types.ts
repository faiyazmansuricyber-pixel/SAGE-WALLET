export interface WalletPolicy {
  agent: `0x${string}`;
  isRevoked: boolean;
  perTxLimit: bigint;
  dailyLimit: bigint;
  validUntil: number;
  spentToday: bigint;
  ethBalance: bigint;
  entryPointDeposit: bigint;
  dayNumber: number;
  isDeployed: boolean;
  isAnvilOnline: boolean;
}

export type EventType =
  | "AgentExecuted"
  | "OwnerExecuted"
  | "Executed"
  | "RecipientSet"
  | "PolicyUpdated"
  | "AgentSet"
  | "AgentRevoked"
  | "ApprovalSet"
  | "ApprovalUsed"
  | "AgentAttemptOffchain";

export type EventFilter = "All" | "Executed" | "Approvals" | "Policy";

export interface DashboardEvent {
  id: string;
  eventName: EventType;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  blockTimestamp?: number;
  args: Record<string, any>;
  color: "green" | "blue" | "amber" | "grey" | "red";
  summary: string;
  isOffchain?: boolean;
}

export interface TxStatus {
  status: "idle" | "pending" | "success" | "error";
  hash?: `0x${string}`;
  message?: string;
  error?: string;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "pending";
  title: string;
  message?: string;
  exiting?: boolean;
}

export interface AgentAttempt {
  id: string;
  timestamp: number;
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  status: "EXECUTED" | "BLOCKED";
  txHash?: `0x${string}`;
  reason?: string;
  userOpHash: `0x${string}`;
  approved?: boolean;
}

export interface AttackResult {
  id: number;
  name: string;
  description: string;
  status: "BLOCKED" | "SUCCEEDED" | "SKIPPED";
  loss: bigint;
  reason: string;
  txHash?: `0x${string}`;
}
