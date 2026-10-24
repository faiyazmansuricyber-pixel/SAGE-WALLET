# Demo Script — Agent Wallet

> **Owner: P4. Fill this file during the 12:00–3:00 AM block.**

## Outline

### 1. Problem Statement (30 sec)
<!-- Explain: AI agents need to transact on-chain, but giving them full key access is dangerous -->

### 2. Solution Overview (30 sec)
<!-- Explain: ERC-4337 wallet with policy-constrained agent key -->

### 3. Live Demo — Happy Path (2 min)
<!-- Steps:
  1. Owner sets policy (max per tx, daily limit, expiry)
  2. Owner adds agent key
  3. Agent purchases credits from MockMerchant
  4. Dashboard shows transaction + remaining budget
-->

### 4. Live Demo — Attack Blocked (2 min)
<!-- Steps:
  1. Show attacker page with hidden prompt injection
  2. Agent visits page and tries to send all funds to 0xATTACKER
  3. Wallet rejects: out-of-policy (wrong recipient / exceeds limit)
  4. Dashboard shows REJECTED state in red
-->

### 5. Attack Results Summary (1 min)
<!-- Show ATTACK_RESULTS.md table on screen -->

### 6. Architecture & Key Takeaways (30 sec)
<!-- Show architecture diagram from slides -->
