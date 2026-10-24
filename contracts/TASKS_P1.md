# Tasks — P1 (Wallet Developer)

> **Owner: P1. You own `contracts/src/`, `contracts/script/`, `shared/abi/`, `shared/addresses.json`.**
> You also own `docs/INTERFACE.md`. Do NOT edit files outside your folders.

## Day 1 — 24 Oct 2026

### By 2:00 PM — Setup
- [ ] Stub interface pushed (done by scaffold)
- [ ] Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- [ ] Run `forge install` in `contracts/`
- [ ] Choose EntryPoint version from `eth-infinitism/account-abstraction` repo
- [ ] Add remappings to `foundry.toml`

### 2:00–5:30 PM — Wallet v1
- [ ] Implement owner and agent key storage
- [ ] Implement `validateUserOp` — check signer, selector, expiry, gas caps
- [ ] Implement `setAgent` / `revokeAgent` (owner only)
- [ ] Implement `setAllowedTarget` / `setAllowedRecipient` (owner only)
- [ ] Implement `executeAsAgent` — per-transaction limit, recipient allowlist
- [ ] Implement `execute` — owner unrestricted
- [ ] Write a deployment script that sends a UserOp through `handleOps`
- **Checkpoint @ 5:30 PM:** agent payment passes, out-of-policy payment reverts. Merge to main.

### 6:15–8:15 PM — Wallet v2
- [ ] Implement daily limit tracking (rolling 24h window)
- [ ] Implement policy expiry (`validUntil`)
- [ ] Implement owner-approval path (for out-of-policy agent requests)
- [ ] Implement `MockMerchant.sol` — `buyCredits` function
- **Checkpoint @ 8:15 PM:** daily limit works, expiry works. Merge to main.

### 9:30 PM–12:00 AM — Hardening
- [ ] Block delegatecall from agent
- [ ] Block self-calls from agent
- [ ] Block `approve` to unknown spenders from agent
- [ ] Add gas cap enforcement
- [ ] Fix bugs reported by P4
- **Checkpoint @ 12:00 AM:** all P4 tests pass. Merge to main.

### 1:30 AM — Contract Freeze
- [ ] Final code review
- [ ] Regenerate `shared/abi/AgentWallet.json` with `forge inspect AgentWallet abi`
- [ ] Update `shared/addresses.json` with deployed addresses
- [ ] Notify group chat: "contracts frozen"
