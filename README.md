# Agent Wallet — HYPNEXIS'26 (W3-02)

An ERC-4337 account-abstraction smart wallet that gives an AI agent a limited key.
The agent can spend only within an owner-defined policy (per-tx cap, daily limit, recipient allowlist, expiry).
Even if the agent is hacked or tricked by a malicious webpage, the wallet enforces the policy on-chain.
Built as a hackathon monorepo with strict folder ownership so four people can work in parallel without conflicts.

---

## Folder Ownership

| Folder | Owner | Role |
|---|---|---|
| `contracts/src/` | P1 | Wallet developer |
| `contracts/script/` | P1 | Wallet developer |
| `shared/abi/` | P1 | Wallet developer |
| `shared/addresses.json` | P1 | Wallet developer |
| `docs/INTERFACE.md` | P1 | Wallet developer |
| `agent/` | P2 | AI Agent developer |
| `shared/userop/` | P2 | AI Agent developer |
| `web/` | P3 | Frontend developer |
| `contracts/test/` | P4 | Tests, security & demo |
| `docs/` (except `INTERFACE.md`) | P4 | Tests, security & demo |

**Golden Rule:** A person edits ONLY the folders they own. If you need a change elsewhere, ask the owner.

---

## Quick Start (commands only — do NOT run install until you read your task file)

### P1 — Wallet Developer
```
git checkout p1-wallet
git pull origin main && git merge main
cd contracts
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install
# Read contracts/TASKS_P1.md
```

### P2 — AI Agent Developer
```
git checkout p2-agent
git pull origin main && git merge main
cd agent
npm install
# Read agent/TASKS_P2.md
```

### P3 — Frontend Developer
```
git checkout p3-web
git pull origin main && git merge main
cd web
npm install
npm run dev
# Read web/TASKS_P3.md
```

### P4 — Tests, Security & Demo
```
git checkout p4-tests
git pull origin main && git merge main
cd contracts
forge test
# Read docs/TASKS_P4.md
```

---

## Key Docs

- [Git Workflow](docs/GIT_WORKFLOW.md) — branching rules, sync points, conflict resolution
- [Interface Contract](docs/INTERFACE.md) — frozen function signatures after 2:00 PM Day 1
