<div align="center">

# 🛡️ Sentinel Wallet
### Letting AI Agents Pay Safely on Ethereum (ERC-4337)

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![ERC-4337](https://img.shields.io/badge/ERC--4337-EntryPoint%20v0.8.0-blue)](https://eips.ethereum.org/EIPS/eip-4337)
[![Foundry](https://img.shields.io/badge/Foundry-Tested%20(33%2F33%20Passing)-red?logo=ethereum)](https://getfoundry.sh/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20Viem-61DAFB?logo=react)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**HYPNEXIS '26 Hackathon Project**  
*Manipal University Jaipur • Department of Computer and Communications Engineering*  
**Problem Statement ID:** `W3-02` • **Domain:** Web3 & Blockchain • **Category:** Software  
**Team:** 3 AM Engineers • **Team ID:** `[UNE25D01]`

---

</div>

## 📌 Executive Summary

Autonomous AI agents increasingly perform micro-transactions: purchasing API credits, querying decentralized data, paying for compute, or booking tickets. However, giving an AI agent an ordinary private key (Externally Owned Account - EOA) creates an existential security hazard: **a single leaked key, compromised dependency, or prompt-injection attack can drain the entire wallet balance instantly.**

Client-side checks inside the AI agent's own code cannot solve this, because the agent itself is the attack surface. **Security rules must be enforced immutably on-chain at the account level.**

**Sentinel Wallet** is an ERC-4337 smart contract wallet engineered specifically for AI agents. The AI agent operates using a strictly scoped session key—never the owner's master key. All agent transactions pass through multi-layer on-chain validation enforcing spending caps, UTC daily budgets, strict recipient/calldata allowlists, single-use exact-call approvals, and emergency freezes.

> **Core Philosophy:** *Loss is strictly bounded by owner-defined limits. We do not claim zero loss—we guarantee contained, provable, and bounded loss.*

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph OwnerControl [Owner Controls (EOA)]
        O[Owner Master Key] -->|setPolicy / setAgent / approveCall / freeze| SW[SentinelWallet.sol]
    end

    subgraph AgentExecution [Agent Lifecycle]
        Agent[AI Agent / Session Key] -->|Signs PackedUserOp| Sim[Dashboard / Bundler]
        Sim -->|handleOps| EP[ERC-4337 EntryPoint v0.8.0]
        EP -->|1. validateUserOp| SW
        EP -->|2. executeUserOp / agentExecute| SW
    end

    subgraph OnChainSecurity [On-Chain Policy Engine]
        SW --> C1{Frozen?}
        C1 -->|Yes| R1[Revert: Signature Failure]
        C1 -->|No| C2{Target is Wallet or EntryPoint?}
        C2 -->|Yes| R2[Revert: TARGET_FORBIDDEN]
        C2 -->|No| C3{Has Owner Exact Approval?}
        C3 -->|Yes & Not Expired| EXEC[Execute Call Once]
        C3 -->|No| C4{Recipient & Call Allowed?}
        C4 -->|No| R3[Revert: RECIPIENT_NOT_ALLOWED]
        C4 -->|Yes| C5{Value <= perTxLimit?}
        C5 -->|No| R4[Revert: PERTX_LIMIT]
        C5 -->|Yes| C6{spentToday + Value <= dailyLimit?}
        C6 -->|No| R5[Revert: DAILY_LIMIT]
        C6 -->|Yes| EXEC
    end

    subgraph OffChainWatchdog [Off-Chain Security Watchdog]
        SW -.->|Observe Reverts| WD[Watchdog Monitor]
        WD -->|N blocked attempts within W seconds| AutoFreeze[Auto-call freeze as Owner]
        AutoFreeze --> SW
    end
```

---

## 🔒 Policy & Security Model

Every interaction initiated by an AI agent undergoes a strict two-stage verification cycle:

### 1. Verification Phase (`validateUserOp`)
Before any UserOperation enters execution, the wallet checks:
1. **Signature Validity:** Verifies ECDSA signature on `userOpHash` (EIP-712 typed digest computed by the EntryPoint covering `chainId` and EntryPoint address). Invalid signatures return `SIG_VALIDATION_FAILED` (1) without reverting.
2. **Emergency Freeze Check:** If `frozen == true`, validation immediately returns signature failure.
3. **Agent Authentication:** Signer must strictly match the designated `agent` key, and the agent must not be revoked (`agent != address(0)`).
4. **Policy Expiration:** Verifies that current block timestamp has not exceeded `validUntil`.
5. **Entrypoint Restrictiveness:** UserOps must execute through `agentExecute(target, value, data)`. Direct calls to administrative functions revert.
6. **Self-Call Prevention:** Calls targeting `address(this)` (the wallet) or the `EntryPoint` contract are unconditionally rejected (`TARGET_FORBIDDEN`), preventing privilege escalation and reentrancy hijacks.
7. **Per-Transaction Cap:** Value must not exceed `perTxLimit`.
8. **Allowlist Verification:** Target must either be explicitly whitelisted via `allowedRecipients[target]` or configured via function-level calldata authorization (`allowedCalls[target][selector]`).

### 2. Execution Phase (`agentExecute`)
1. **Reentrancy Protection:** Guarded by OpenZeppelin's `ReentrancyGuard`.
2. **One-Time Approvals:** If the owner has registered an out-of-policy approval via `approveCall(keccak256(abi.encode(target, value, data)), expiry)`, the transaction executes once, consumes the approval, and bypasses standard limits.
3. **Daily Budget Metering:** Tracks cumulative expenditures per calendar day (`day = block.timestamp / 86400`). Ensures `spentOnDay[day] + value <= dailyLimit`.
4. **Safe Transfer:** Updates state accounting *before* transferring native ETH (Checks-Effects-Interactions pattern).

---

## ⚡ Attack Lab: Real On-Chain Exploits

Sentinel Wallet includes a live **Attack Lab** in the dashboard that executes 7 real sequential attack vectors against the deployed smart wallet on a local Anvil chain:

| # | Attack Vector | Target & Intent | Expected Defense | Observed Outcome |
|---|---------------|-----------------|------------------|------------------|
| **1** | **Unknown Recipient** | Pays 0.1 ETH to unauthorized recipient (`0x...dEaD`) | Target allowlist check | 🛡️ **BLOCKED** (`RECIPIENT_NOT_ALLOWED`) |
| **2** | **Exceed Per-Tx Limit** | Attempts to send `perTxLimit + 1 wei` to whitelisted address | Per-tx validation | 🛡️ **BLOCKED** (`PERTX_LIMIT`) |
| **3** | **Rapid Drain Loop** | Submits continuous drain transactions to exhaust wallet | UTC Daily spending limit | ⚠️ **CONTAINED** (Stopped at daily limit) |
| **4** | **Self-Call Escalation** | Agent calls wallet itself to invoke `setPolicy(100 ETH, ...)` | Anti-self-call guard | 🛡️ **BLOCKED** (`TARGET_FORBIDDEN`) |
| **5** | **EntryPoint Exploit** | Agent attempts to send transactions directly to EntryPoint | EntryPoint target blacklist | 🛡️ **BLOCKED** (`TARGET_FORBIDDEN`) |
| **6** | **Rogue Key Hijacking** | UserOp signed with an unauthorized random private key | Signature verification | 🛡️ **BLOCKED** (Signature invalid) |
| **7** | **Nonce Replay Attack** | Resubmits identical previously executed UserOperation | EntryPoint nonce tracking | 🛡️ **BLOCKED** (`AA25 invalid account nonce`) |

> **Audit Metric:** In standard test runs, **6 of 7 attacks are blocked outright with 0 ETH moved**, while the rapid drain loop is strictly bounded by the owner's daily budget limit.

---

## 🚨 Off-Chain Security Watchdog

In addition to on-chain policy enforcement, Sentinel Wallet includes an **Off-Chain Watchdog**:
- **Sliding Window Observation:** Monitors blocked agent UserOps across the Agent Simulator and Attack Lab.
- **Configurable Thresholds:** Configured with defaults $N = 3$ blocked attempts within $W = 60$ seconds (fully editable in the dashboard).
- **Automated Emergency Freeze:** Automatically invokes `freeze()` on-chain as the owner account when the threshold is triggered, showing a toast notification: `"Watchdog froze the wallet"`.
- **Honest Detection Rate:** Computes detection statistics strictly from real Attack Lab executions (`detection: X of Y runs`), logging whether the watchdog froze during each run and the exact ETH lost before the freeze.
- **False-Alarm Mitigation:** Provides a `"Mark last freeze as false alarm"` action that increments a transparent false-freeze counter.
- **Panel Label:** *"Off-chain watchdog; the freeze itself is enforced on-chain."*

---

## 🧪 Comprehensive Test Suite (33/33 Passing)

The smart contracts are thoroughly verified using Foundry with unit tests, fuzzing, and stateful invariant testing:

```
Ran 7 test suites in 35.11s: 33 tests passed, 0 failed, 0 skipped
```

### Breakdown of Test Suites
1. **`Gate0.t.sol`**: Verifies EntryPoint deployment and basic bytecode initialization.
2. **`ChainId.t.sol`**: Proves signature replay across different EVM chains is rejected.
3. **`Signature.t.sol`**: Validates signature verification, nonces, and rejected rogue signers.
4. **`Policy.t.sol` (16 tests)**:
   - Per-transaction limit boundaries (`exactOk`, `overReverts`).
   - Daily limit containment and midnight UTC reset (`dailyLimit_blocksFourth`, `resetsNextDay`).
   - Target protection (`targetWallet_blockedEvenWithApproval`, `targetEntryPoint_blockedEvenWithApproval`).
   - Recipient allowlists and agent revocation checks.
   - Owner exact-call approvals (`allowsOnce_skipsLimits`, `differentValue_fails`, `expired_fails`).
   - Agent privilege restrictions (agent cannot call `setPolicy` directly or via UserOp).
5. **`Freeze.t.sol` (7 tests)**:
   - Validates owner freeze & unfreeze mechanisms.
   - Asserts non-owners and agent keys cannot call freeze.
   - Proves UserOps and approved calls fail with signature rejection when frozen.
   - Proves unfreezing restores normal policy operation without altering allowlists.
6. **`Fuzz.t.sol` (3 fuzz tests, 256 runs each)**:
   - `testFuzz_amountGreaterThanPerTxLimit`: Recipient balance never increases.
   - `testFuzz_randomSignerKey`: Unauthorized random keys never execute.
   - `testFuzz_randomAmountsRepeatedly`: Sum of executed transfers never exceeds `dailyLimit`.
7. **`Invariant.t.sol` (Stateful property-based testing with Handler)**:
   - **Runs:** 256 runs, 128,000 handler calls.
   - **Ghost Counters:** Tracks `okOps`, `blockedOps`, and `totalMoved`.
   - **Invariants Checked:**
     - `invariant_totalEthLeftWalletLeDailyLimit`: Total ETH that left the wallet $\le$ `dailyLimit`.
     - `invariant_policyAndAllowlistsNeverChange`: Agent actions cannot modify owner, agent key, limits, expiry, or allowlists.
     - `invariant_nonAgentKeyNeverMovesFunds`: Non-agent keys cannot move funds.
   - **Non-vacuity:** Includes `test_handlerCanActuallyMoveFunds` ensuring handler actions move funds under valid parameters.

---

## 💻 Tech Stack & Standards

| Component | Technology | Version / Standard |
|-----------|------------|-------------------|
| **Smart Contracts** | Solidity | `^0.8.28` |
| **Account Abstraction** | eth-infinitism | ERC-4337 EntryPoint `v0.8.0`, `BaseAccount` |
| **Cryptography & Utilities** | OpenZeppelin | `v5.1.0` (`ECDSA`, `EIP712`, `ReentrancyGuard`) |
| **Contract Testing & Node** | Foundry | Forge, Cast, Anvil local node (`chainId: 31337`) |
| **Frontend Framework** | React + Vite | React 18, TypeScript, Vanilla CSS |
| **Web3 Client** | viem | `v2.x` (UserOp packing, hashing, RPC handling) |

---

## 🚀 Quickstart & Installation

### Prerequisites
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Foundry](https://getfoundry.sh/) (`forge`, `anvil`, `cast`)

---

### Option A: 1-Click Automated Startup (Windows)

Simply double-click or run:
```cmd
START-ALL.bat
```
This batch script automatically:
1. Detects or launches a local **Anvil** node (`127.0.0.1:8545`).
2. Deploys the `EntryPoint`, `SentinelWallet`, and test recipient contracts via Foundry script.
3. Installs frontend dependencies (if not already installed).
4. Launches the Vite development server and opens `http://localhost:5173` in your browser.

---

### Option B: Manual Step-by-Step Setup

#### 1. Start Local Anvil Chain
```bash
anvil --code-size-limit 50000
```

#### 2. Deploy Contracts
In a new terminal:
```bash
forge script contracts/script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```
The deployment will output contract addresses into `shared/addresses.json`.

#### 3. Run Contract Test Suite
```bash
forge test
```

#### 4. Launch the Web Dashboard
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📂 Repository Structure

```
sentinel-wallet/
├── contracts/                     # Foundry smart contracts
│   ├── src/
│   │   ├── SentinelWallet.sol     # Core ERC-4337 smart wallet with policy engine
│   │   └── AgentWallet.sol        # Prototype reference implementation
│   ├── script/
│   │   └── Deploy.s.sol           # Anvil deployment script
│   └── test/
│       ├── Base.t.sol             # Shared test setup & helpers
│       ├── ChainId.t.sol          # Chain ID signature domain tests
│       ├── Freeze.t.sol           # Emergency freeze unit tests
│       ├── Fuzz.t.sol             # Property-based fuzz tests
│       ├── Gate0.t.sol            # EntryPoint deployment verification
│       ├── Invariant.t.sol        # Stateful invariant tests with Handler
│       ├── Policy.t.sol           # Policy limits, approvals & allowlist tests
│       └── Signature.t.sol        # Signature verification & replay tests
├── shared/
│   ├── abi/                       # Generated contract ABIs
│   │   └── SentinelWallet.json
│   └── addresses.json             # Live deployed addresses on local Anvil
├── web/                           # Vite + React + TypeScript Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionForms.tsx    # Owner policy, allowlist & freeze forms
│   │   │   ├── AgentSimulator.tsx # Real-time agent UserOp simulator
│   │   │   ├── AttackLab.tsx      # 7 sequential on-chain attack vectors
│   │   │   ├── EventFeed.tsx      # Real-time on-chain event stream
│   │   │   ├── Header.tsx         # Node connection & status header
│   │   │   ├── StatusPanel.tsx    # Policy overview & daily budget bar
│   │   │   ├── StickyNav.tsx      # In-page section navigation
│   │   │   ├── ToastContainer.tsx # User notification toasts
│   │   │   └── WatchdogPanel.tsx  # Off-chain watchdog controls & counters
│   │   ├── client.ts              # Viem clients & Anvil account configs
│   │   ├── constants.ts           # Chain IDs, contract ABIs & presets
│   │   ├── types.ts               # TypeScript data models
│   │   ├── userop.ts              # ERC-4337 UserOp packing, hashing & submission
│   │   └── App.tsx                # Main dashboard coordinator
│   ├── index.html
│   └── package.json
├── START-ALL.bat                  # One-click start script for Windows
├── foundry.toml                   # Foundry configuration
└── README.md                      # Project documentation
```

---

## ⚖️ Known Limitations & Honest Constraints

In alignment with our hackathon presentation:
1. **Fixed UTC-Day Spending Window:** The daily limit resets at `00:00 UTC` (`block.timestamp / 86400`). A transaction sequence executed across the midnight UTC boundary can expend up to $2\times$ the daily limit within an abbreviated timeframe.
2. **Leaked Key Bounded Spending:** A compromised agent key can still spend funds up to the configured limits before being revoked or frozen by the owner.
3. **Owner-Approved Calls:** Calls approved explicitly via `approveCall` bypass standard per-tx and daily limits.
4. **Native ETH Metering:** The current policy engine meters native ETH transfers. ERC-20 token transfer allowances inside approved contracts are not yet metered on-chain.
5. **Failed Operation Gas Overhead:** While malicious UserOps are prevented from moving wallet funds, failed operations still consume execution gas from the wallet's EntryPoint deposit.
6. **Prototype Scope:** Designed and validated on local Anvil with test keys. Mainnet readiness requires an external security audit.

---

## 🗺️ Roadmap & Future Scope

- [ ] **Rolling Window Limits:** Transition from fixed UTC-day slots to rolling 24-hour sliding window rate-limiting.
- [ ] **Token-Aware Policy Engine:** Extend allowlist and limits to decode and meter ERC-20 (`transfer`, `approve`) and ERC-721 calls.
- [ ] **Guardian Social Recovery:** Implement a 3-of-5 guardian recovery system with a 48-hour timelock and owner veto.
- [ ] **Per-Agent Gas Quotas:** Introduce gas prefund quotas per session key to prevent EntryPoint deposit exhaustion attacks.
- [ ] **Cross-Chain / L2 Deployment:** Deploy and test on low-cost Layer 2 rollups (Arbitrum, Optimism, Base).

---

## 👥 Hackathon Team & Credits

Developed during **HYPNEXIS '26** (36-Hour Hackathon • 24–25 October 2026) at **Manipal University Jaipur**:

- **Team Name:** 3 AM Engineers
- **Team ID:** `[UNE25D01]`
- **Problem Statement:** `W3-02` (*Agent Wallet: Letting AI Agents Pay Safely*)
- **Department:** Computer and Communications Engineering


---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
