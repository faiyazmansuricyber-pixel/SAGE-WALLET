# Interface Contract — AgentWallet.sol

> **This file is owned by P1. Only P1 edits this file and `shared/abi/AgentWallet.json`.**
> P1 must notify the group chat after any change.

## Design Rule

`validateUserOp` implements the ERC-4337 v0.7 account interface and is callable only by the configured EntryPoint. It checks the EntryPoint-managed nonce and agent signature over the standard UserOperation hash, and returns the policy expiry as ERC-4337 validation data. `executeAsAgent` allows only configured-token `transfer(address,uint256)` calls with token-specific limits and an allowlisted recipient, or plain ETH sends to allowlisted addresses with no contract code. All other contract calls are blocked, including owner-allowlisted routers, because their indirect asset movements cannot be safely accounted for. Sponsored gas quotas are enforced by `AgentPaymaster.validatePaymasterUserOp` and charged in `postOp`.

The deployment expects an already deployed ERC-4337 v0.7 EntryPoint and a compatible bundler endpoint (`ENTRYPOINT_ADDRESS` and `BUNDLER_RPC_URL`). The deployment script creates, stakes, and prefunds the paymaster; the reported paymaster address must be configured for the bot and dashboard. Because quota validation reserves gas in paymaster storage, the bundler must allow this stateful paymaster. This repository does not include an EntryPoint implementation or a local bundler.

---

## **⚠️ FREEZE RULE**

**After 2:00 PM on Day 1 (24 Oct 2026) no function name, parameter, or event may change. Only the code inside functions may change. Only P1 edits this file and `shared/abi/AgentWallet.json`, and P1 must tell the group on chat after any change.**

---

## Function Signatures

| Function | Signature | Who Calls | Who Builds Against |
|---|---|---|---|
| `setAgent` | `setAgent(address agent, Policy calldata policy)` | Owner (P3 UI) | P1, P3 |
| `revokeAgent` | `revokeAgent()` | Owner (P3 UI) | P1, P3 |
| `setAllowedTarget` | `setAllowedTarget(address target, bytes4 selector, bool allowed)` | Owner (legacy configuration; does not enable arbitrary calls) | P1, P3 |
| `setAllowedRecipient` | `setAllowedRecipient(address recipient, bool allowed)` | Owner (P3 UI) | P1, P3 |
| `setTokenPolicy` | `setTokenPolicy(address token, uint256 maxPerTx, uint256 dailyLimit)` | Owner | P1 |
| `setEntryPoint` | `setEntryPoint(address entryPointAddress)` | Owner, once | P1 |
| `validateUserOp` | `validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)` | ERC-4337 v0.7 EntryPoint | P1 |
| `executeAsAgent` | `executeAsAgent(address target, uint256 value, bytes calldata data)` | Agent directly or EntryPoint after validation | P1, P2 |
| `execute` | `execute(address target, uint256 value, bytes calldata data)` | Owner (unrestricted) | P1, P3 |
| `getPolicy` | `getPolicy() → Policy memory` | Anyone (view) | P2, P3 |
| `spentToday` | `spentToday() → uint256` | Anyone (view) | P2, P3 |
| `agent` | `agent() → address` | Anyone (view) | P2, P3 |
| `owner` | `owner() → address` | Anyone (view) | P3 |

## Struct

```solidity
struct Policy {
    uint256 maxPerTx;
    uint256 dailyLimit;
    uint48 validUntil;
}

struct TokenPolicy {
    uint256 maxPerTx;   // token base units
    uint256 dailyLimit; // token base units per policy window
}
```

## Events

| Event | Signature |
|---|---|
| `AgentSet` | `AgentSet(address agent)` |
| `AgentRevoked` | `AgentRevoked()` |
| `AgentExecuted` | `AgentExecuted(address target, uint256 value, bytes4 selector)` |
| `OwnerExecuted` | `OwnerExecuted(address target, uint256 value)` |

## Custom Errors

| Error | When |
|---|---|
| `NotImplemented()` | Stub — function not yet coded |
| `NotAllowedTarget()` | Target+selector not in allowlist |
| `NotAllowedRecipient()` | Recipient not in allowlist |
| `ExceedsPerTxLimit()` | `value > policy.maxPerTx` |
| `ExceedsDailyLimit()` | `spentToday + value > policy.dailyLimit` |
| `PolicyExpired()` | `block.timestamp > policy.validUntil` |
| `ForbiddenCall()` | Blocked call pattern, including all non-token contract calls and contract fallback paths |
| `NotOwner()` | Caller is not the owner |
| `NotAgent()` | Caller/signer is not the agent |
