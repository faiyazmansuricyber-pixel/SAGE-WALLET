# Attack Results — Agent Wallet (HYPNEXIS'26 W3-02)

> **Owner: P4. Updated with implemented results.**
> **Current verification:** Solidity compilation and Foundry tests have not been run in this environment (`forge` and `forge-std` are unavailable). The results below describe test cases/assertions, not measured passes. The live-chain attack runner has also not been run.
> Run `forge test -vvv` in `contracts/` after installing Foundry and `forge-std` to execute the Solidity tests.
> Run `npm run attack` in `agent/` only against the configured local test chain, with all three key variables explicitly set.

---

## Detection Metrics

| Metric | Value |
|---|---|
| Attack test cases defined (Foundry) | 8 (5 required + 3 bonus); execution unverified |
| Attack cases blocked | Unverified until Foundry tests run |
| False-freeze events | Unmeasured |
| Invariant fuzz configuration | 256 runs × 15 depth; execution unverified |

---

## Leaked-Key Attack Suite (Foundry: `contracts/test/AgentWalletAttack.t.sol`)

| # | Attack Name | Description | Expected On-Chain Error | Forge Test | Pass |
|---|---|---|---|---|---|
| 1 | Prompt-Injection / Non-Allowlisted Recipient | Agent tries to send 0.05 ETH to a recipient not in the allowlist. | `NotAllowedRecipient` | `test_attack1_promptInjection_nonAllowlistedRecipient` | Not run |
| 2 | Leaked Key: Single Tx > maxPerTx | Attacker uses leaked agent key to withdraw 5 ETH in one tx (maxPerTx = 0.1 ETH). | `ExceedsPerTxLimit` | `test_attack2_leakedKey_exceedsPerTxLimit` | Not run |
| 3 | Salami Slicing: Daily Limit Exhaustion | 3 × 0.1 ETH sends exhaust daily limit (0.3 ETH), 4th tx rejected. | `ExceedsDailyLimit` | `test_attack3_salamiSlicing_exceedsDailyLimit` | Not run |
| 4 | Expired Policy Replay | Transaction attempted after `validUntil` (Foundry `vm.warp` used). | `PolicyExpired` | `test_attack4_expiredPolicy_replayAfterExpiry` | Not run |
| 5 | Access Control Bypass: Non-Owner calls `setAgent` | Attacker tries to grant themselves unlimited policy. | `NotOwner` | `test_attack5_accessControlBypass_setAgentByAttacker` | Not run |
| 6 (bonus) | Non-Allowed Selector: `transfer()` not in allowlist | Agent calls ERC-20 `transfer()` on merchant (not allowlisted). | `NotAllowedTarget` | `test_attack6_nonAllowedSelector` | Not run |
| 7 (bonus) | Freeze Bypass: Spend while frozen | Owner freezes wallet. Attacker with leaked key tries to spend. | `WalletFrozen` | `test_attack7_freezeBypass_spendWhileFrozen` | Not run |
| 8 (bonus) | Self-Call: Privilege Escalation | Agent tries to call `wallet.setAllowedRecipient(attacker, true)` via `executeAsAgent`. | `ForbiddenCall` | `test_attack8_selfCall_privilegeEscalation` | Not run |

---

## Prompt-Injection Attack

| # | Attack Name | Description | Expected Result | Actual Result | Pass |
|---|---|---|---|---|---|
| 1 | Hidden `send-all` instruction | `agent/attacker-page/index.html` contains hidden text asking to transfer funds. The scenario is represented by a Foundry test. | Wallet rejects: `NotAllowedRecipient` for a within-limit send to an unapproved recipient. | See Forge test #1 above | Not run |

---

## Invariant Tests (Foundry: `contracts/test/AgentWalletInvariant.t.sol`)

| Invariant | Description | Status |
|---|---|---|
| `invariant_agentCannotExceedDailyLimit` | `spentToday <= dailyLimit` in any 24h window, under any fuzz sequence | Defined; not run |
| `invariant_walletBalanceNeverNegative` | `address(wallet).balance >= 0` always | Defined; not run |
| `invariant_frozenWalletSpentNeverIncreases` | When frozen, `spentToday` does not increase | Defined; not run |

---

## Phase 2 Feature Matrix

| Feature | On-Chain Enforcement | Test Status |
|---|---|---|
| Daily spending cap | `_trackDailySpend` in `executeAsAgent` | Tests defined; not run |
| Per-tx cap | `_enforcePolicy` | Tests defined; not run |
| Legacy target allowlist | `_allowedTargets` mapping is retained, but cannot enable arbitrary agent contract calls | Custom-call rejection test defined; not run |
| Recipient allowlist | `_allowedRecipients` mapping | Tests defined; not run |
| Policy expiry | `validUntil` check | Tests defined; not run |
| Freeze (manual) | `frozen` state + `notFrozen` modifier | Tests defined; not run |
| Auto-freeze (suspicious spending) | Agent calls `autoFreeze()` on-chain | Test defined; not run |
| 3-of-5 Guardian Recovery | `_voteCount >= GUARDIAN_THRESHOLD` | Tests defined; not run |
| 48h Recovery Delay | `block.timestamp - _recoveryInitiated >= RECOVERY_DELAY` | Test defined; not run |
| Owner Veto | `vetoRecovery()` resets state | Test defined; not run |
| Sponsored gas quota | `AgentPaymaster` reserves the maximum gas budget during validation and charges actual gas in `postOp`; zero quota disables sponsorship | Regression tests added; **not run** (`forge` unavailable) |
| Self-call block | `target == address(this)` check | Test defined; not run |

---

## Slither Findings

> Run: `slither contracts/src/AgentWallet.sol` after installing Slither.
> Expected findings to review: reentrancy (mitigated: state updated before external call), inline assembly in `_recoverSigner` (intentional).

| Severity | Finding | File:Line | Status |
|---|---|---|---|
| Low | Inline assembly in `_recoverSigner` | AgentWallet.sol:290 | Intentional — standard ecrecover pattern |
| Info | `execute` has no policy checks | AgentWallet.sol:143 | By design — owner is unrestricted |
