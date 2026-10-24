# Tasks — P4 (Tests, Security & Demo)

> **Owner: P4. You own `contracts/test/` and `docs/` (except `docs/INTERFACE.md`).**
> Do NOT edit files outside your folders. Ask the owner if you need a change.

## Day 1 — 24 Oct 2026

### 2:00–5:30 PM — Foundry Test Stubs
- [ ] Write Foundry tests against the stub interface in `contracts/test/`
- [ ] Tests should call every function and expect `NotImplemented()` revert for now
- [ ] One test per function: `setAgent`, `revokeAgent`, `setAllowedTarget`, `setAllowedRecipient`, `executeAsAgent`, `execute`, `getPolicy`, `spentToday`
- [ ] Tests will fail on stubs — they should pass once P1 implements the logic
- **Checkpoint @ 5:30 PM:** all test files exist and compile, merge to main

### 6:15–8:15 PM — Attack Tests
- [ ] Write one attack test per policy rule:
  - [ ] Exceed per-tx limit → revert `ExceedsPerTxLimit`
  - [ ] Exceed daily limit → revert `ExceedsDailyLimit`
  - [ ] Expired policy → revert `PolicyExpired`
  - [ ] Non-allowed target → revert `NotAllowedTarget`
  - [ ] Non-allowed recipient → revert `NotAllowedRecipient`
  - [ ] Delegatecall attempt → revert `ForbiddenCall`
  - [ ] Self-call attempt → revert `ForbiddenCall`
  - [ ] Non-owner calling owner functions → revert `NotOwner`
  - [ ] Non-agent calling agent functions → revert `NotAgent`
- **Checkpoint @ 8:15 PM:** attack tests written, merge to main

### 9:30 PM–12:00 AM — Full Security Audit
- [ ] Run the attack test suite end-to-end
- [ ] Write the invariant test: "agent can never spend more than the daily limit in any 24-hour window"
- [ ] Run Slither on `contracts/src/AgentWallet.sol`
- [ ] Report any bugs found to P1 immediately on chat
- **Checkpoint @ 12:00 AM:** all tests pass, Slither report reviewed, merge to main

### 12:00–3:00 AM — Demo Preparation
- [ ] Fill `docs/ATTACK_RESULTS.md` with results (attack name, expected outcome, actual outcome)
- [ ] Write `docs/DEMO_SCRIPT.md` (step-by-step demo flow)
- [ ] Build 6 presentation slides (problem → solution → architecture → demo → attacks → results)
- [ ] Record a backup demo video (screen recording of the full demo flow)
- [ ] Run a full rehearsal at **2:30 AM**
- **Final tag @ 3:00 AM:** `round1-final`
