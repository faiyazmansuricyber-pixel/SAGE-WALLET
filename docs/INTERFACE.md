# Interface Contract — AgentWallet.sol

> **This file is owned by P1. Only P1 edits this file and `shared/abi/AgentWallet.json`.**
> P1 must notify the group chat after any change.

## Design Rule

`validateUserOp` only checks: signer identity, selector allowlist, expiry, and gas caps.
The **full spending policy** (per-tx limit, daily limit, recipient allowlist) runs **inside `executeAsAgent`**, not in validation.

---

## **⚠️ FREEZE RULE**

**After 2:00 PM on Day 1 (24 Oct 2026) no function name, parameter, or event may change. Only the code inside functions may change. Only P1 edits this file and `shared/abi/AgentWallet.json`, and P1 must tell the group on chat after any change.**

---

## Function Signatures

| Function | Signature | Who Calls | Who Builds Against |
|---|---|---|---|
| `setAgent` | `setAgent(address agent, Policy calldata policy)` | Owner (P3 UI) | P1, P3 |
| `revokeAgent` | `revokeAgent()` | Owner (P3 UI) | P1, P3 |
| `setAllowedTarget` | `setAllowedTarget(address target, bytes4 selector, bool allowed)` | Owner (P3 UI) | P1, P3 |
| `setAllowedRecipient` | `setAllowedRecipient(address recipient, bool allowed)` | Owner (P3 UI) | P1, P3 |
| `executeAsAgent` | `executeAsAgent(address target, uint256 value, bytes calldata data)` | Agent via EntryPoint | P1, P2 |
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
| `ForbiddenCall()` | Blocked call pattern (delegatecall, self-call, etc.) |
| `NotOwner()` | Caller is not the owner |
| `NotAgent()` | Caller/signer is not the agent |
