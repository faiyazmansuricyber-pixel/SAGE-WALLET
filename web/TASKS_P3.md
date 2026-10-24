# Tasks — P3 (Frontend Developer)

> **Owner: P3. You own `web/`.**
> Do NOT edit files outside your folder. Ask the owner if you need a change.

## Day 1 — 24 Oct 2026

### 2:00–5:30 PM — Dashboard with Fake Data
- [ ] Set up Vite + React + TypeScript + Tailwind
- [ ] Build dashboard screens with **hardcoded fake data** (no contract calls yet):
  - [ ] Policy settings panel (maxPerTx, dailyLimit, validUntil)
  - [ ] "Spent Today" display with progress bar
  - [ ] Agent transaction list (table with target, value, selector, timestamp)
  - [ ] Pending approvals list (agent requests waiting for owner sign-off)
- **Checkpoint @ 5:30 PM:** all screens render with fake data. Merge to main.

### 6:15–8:15 PM — Contract Integration
- [ ] Import ABI from `shared/abi/AgentWallet.json`
- [ ] Import addresses from `shared/addresses.json`
- [ ] Set up wagmi + viem provider
- [ ] MetaMask connect button
- [ ] Read live data from contract: `getPolicy()`, `spentToday()`, `agent()`, `owner()`
- [ ] Wire up owner actions: `setAgent`, `revokeAgent`, `setAllowedTarget`, `setAllowedRecipient`
- **Checkpoint @ 8:15 PM:** dashboard shows live contract data. Merge to main.

### 9:30 PM–12:00 AM — Approval + Blocked Attempts
- [ ] Owner approval signing UI (sign a message to approve an out-of-policy agent request)
- [ ] Blocked-attempts log screen:
  - [ ] Show failed agent transactions
  - [ ] Clear red **"REJECTED"** badge on each blocked attempt
  - [ ] Show reason: `NotAllowedTarget`, `ExceedsPerTxLimit`, etc.
- **Checkpoint @ 12:00 AM:** approval + rejection screens work. Merge to main.

### 12:00 AM onward — Demo Polish
- [ ] Show agent address prominently
- [ ] Show current limits with visual indicators
- [ ] Live ETH balance display
- [ ] Responsive layout for demo screen
- [ ] Final visual polish for presentation
