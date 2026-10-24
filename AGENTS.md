# ProofPass — Agent Instructions

> **This file is for the AI coding agent.** Read this FIRST when opening this repository.

## Quick Start for Agent

1. **Read** `PROJECT_CONTEXT.md` — the master project context.
2. **Read** `docs/INTERFACE_CONTRACT.md` — all shared data formats and interfaces.
3. **Read** `docs/HANDOFF_LOG.md` — check what artifacts are available.
4. **Identify** which team member you are working for (ask the user if unclear).
5. **Read** your member brief in `docs/members/<name>.md`.
6. **Only work on files assigned to your member.** Do not touch other members' files.
7. **Follow** the interface contract exactly. Do not invent new formats.

## Member → File Ownership

| Member | Owns | Does NOT touch |
|---|---|---|
| Tufel | `circuits/`, `scripts/`, `shared/`, `contracts/Verifier.sol` (auto-gen only) | `contracts/ScholarshipVerifier.sol`, `frontend/`, `test/` |
| Kaif | `contracts/ScholarshipVerifier.sol`, `test/contract_tests.js` | `circuits/`, `scripts/`, `frontend/`, `shared/` |
| Faiyaz | `frontend/` | `circuits/`, `scripts/`, `contracts/`, `shared/` |
| Heet | `test/` (except contract_tests.js), `docs/SETUP_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md` | `circuits/`, `scripts/`, `contracts/`, `frontend/` |

## Critical Rules

- **Never fake cryptography.** No mock proofs, no simulated verification.
- **Never expose private data.** Income, credential hash, and signature must stay private.
- **Never overwrite shared interfaces** without updating `INTERFACE_CONTRACT.md`.
- **Always log handoffs** in `docs/HANDOFF_LOG.md`.
- **Always check dependencies** before starting work. If a required artifact is missing, create a clearly-labelled placeholder.
