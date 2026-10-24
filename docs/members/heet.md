# Heet — Testing, Integration & Documentation Brief

> **Role:** Test cases, integration checks, documentation & presentation
> **Primary directories:** `test/`, `docs/`

---

## 🎯 Your Mission

You are the quality gate. Nothing ships until you verify it works end-to-end. You also own the documentation and presentation that explains ProofPass to the outside world.

---

## 📋 What You Must Build

### 1. Test Suite (`test/`)

#### a. Circuit Tests (`test/circuit_tests.js`)
Verify Tufel's circuit using snarkjs:

| Test ID | Scenario | Expected |
|---|---|---|
| CT-01 | Valid credential, income = 250000 (below 300000) | Proof generated, `eligible = 1` |
| CT-02 | Valid credential, income = 350000 (above 300000) | Proof generated, `eligible = 0` |
| CT-03 | Valid credential, income = 300000 (exactly at threshold) | Proof generated, `eligible = 0` (strictly less than) |
| CT-04 | Valid credential, income = 0 | Proof generated, `eligible = 1` |
| CT-05 | Valid credential, income = 299999 (edge case) | Proof generated, `eligible = 1` |
| CT-06 | Tampered credential (modified income, original signature) | Witness generation fails |
| CT-07 | Wrong issuer key | Witness generation fails |
| CT-08 | Negative income (if applicable) | Circuit rejects or handles gracefully |

#### b. Contract Tests (`test/contract_tests.js`)
Verify Kaif's Solidity contracts (coordinate with Kaif — they may already write some):

| Test ID | Scenario | Expected |
|---|---|---|
| ST-01 | Submit valid proof for eligible student | Returns `true`, emits event |
| ST-02 | Submit valid proof for ineligible student | Returns `false` |
| ST-03 | Submit tampered proof (modified pi_a) | Reverts or returns `false` |
| ST-04 | Submit wrong public signals | Reverts or returns `false` |
| ST-05 | Submit empty calldata | Reverts |

#### c. Integration Tests (`test/integration_tests.js`)
End-to-end flow:

| Test ID | Scenario | Expected |
|---|---|---|
| IT-01 | Generate credential → generate proof → verify on-chain | Full pass |
| IT-02 | Generate credential → tamper → generate proof → verify | Rejected |
| IT-03 | Valid proof displayed correctly in frontend | UI shows "ELIGIBLE" |
| IT-04 | Invalid proof displayed correctly in frontend | UI shows "INVALID" |

#### d. Privacy Tests (`test/privacy_tests.js`)

| Test ID | Scenario | Expected |
|---|---|---|
| PT-01 | Inspect `public.json` | Does NOT contain income value |
| PT-02 | Inspect `public.json` | Does NOT contain student name or ID |
| PT-03 | Inspect emitted events | Does NOT contain income or identity |
| PT-04 | Inspect UI DOM | No hidden elements containing income |

### 2. Documentation (`docs/`)

#### a. Setup Guide (`docs/SETUP_GUIDE.md`)
Step-by-step instructions for:
- Installing prerequisites (Node.js, Circom, snarkjs)
- Cloning the repo and installing dependencies
- Running the trusted setup
- Generating a sample credential and proof
- Deploying contracts (Remix or Hardhat)
- Launching the frontend
- Running tests

#### b. Architecture Document (`docs/ARCHITECTURE.md`)
- System overview diagram (use Mermaid)
- Component descriptions
- Data flow (what moves between components)
- Security model (what is hidden, what is public)
- Threat model (what attacks are prevented, what is out of scope)

#### c. Demo Script (`docs/DEMO_SCRIPT.md`)
A step-by-step script for the team presentation:
1. Show the credential (point out that income is visible here)
2. Generate the proof (explain what's happening)
3. Show the public signals (point out income is NOT there)
4. Verify (show ELIGIBLE result)
5. Tamper and re-verify (show REJECTED result)
6. Explain the privacy guarantee

---

## 📦 Files You Own

```
test/
├── circuit_tests.js            ← Circuit correctness tests
├── contract_tests.js           ← Solidity contract tests (coordinate with Kaif)
├── integration_tests.js        ← End-to-end flow tests
├── privacy_tests.js            ← Privacy verification tests
└── test_data/
    ├── valid_credential.json   ← Test fixture: valid, eligible
    ├── high_income_credential.json  ← Test fixture: valid, ineligible
    └── tampered_credential.json     ← Test fixture: tampered

docs/
├── INTERFACE_CONTRACT.md       ← Shared (read-only for you, update with team approval)
├── HANDOFF_LOG.md              ← Shared (you can add entries)
├── SETUP_GUIDE.md              ← You write this
├── ARCHITECTURE.md             ← You write this
├── DEMO_SCRIPT.md              ← You write this
└── members/                    ← Read-only (don't edit others' briefs)
```

> [!CAUTION]
> Do not modify files in `circuits/`, `scripts/`, `contracts/`, or `frontend/`. Those belong to other team members. If you find bugs, **file them in the handoff log or create an issue** — don't fix them in other members' code.

---

## 🔗 What You Need From Others

| Artifact | From | Status |
|---|---|---|
| Compiled circuit + proof scripts | Tufel | ⏳ Waiting |
| Sample credential + proof/public JSON | Tufel | ⏳ Waiting |
| Deployed contracts (or Remix setup guide) | Kaif | ⏳ Waiting |
| Working frontend | Faiyaz | ⏳ Waiting |
| All test results from each member's self-tests | Everyone | ⏳ Waiting |

> [!NOTE]
> You can start writing test **skeletons** and documentation **outlines** immediately. Fill in the actual test execution results as artifacts become available.

---

## 🔗 Your Handoffs

| Artifact | Goes To | Why They Need It |
|---|---|---|
| Test results report | Everyone | Identifies bugs before demo |
| `SETUP_GUIDE.md` | Everyone | Reproducible environment setup |
| `DEMO_SCRIPT.md` | Everyone | Consistent presentation |
| `ARCHITECTURE.md` | Everyone | System understanding |

---

## 🧪 Self-Tests Before Handoff

- [ ] All circuit tests pass (CT-01 through CT-08)
- [ ] All contract tests pass (ST-01 through ST-05)
- [ ] All integration tests pass (IT-01 through IT-04)
- [ ] All privacy tests pass (PT-01 through PT-04)
- [ ] Setup guide tested on a clean environment
- [ ] Architecture doc reviewed by at least one team member
- [ ] Demo script rehearsed at least once

---

## 💡 Implementation Tips

1. **Start with test skeletons:** Write all test cases as empty functions with descriptive names and comments. Fill in the implementation as artifacts arrive.

2. **Use consistent test fixtures:** Create your `test_data/` files based on the credential format in `INTERFACE_CONTRACT.md`. When Tufel's real credential script is ready, regenerate them.

3. **Automate where possible:** Use a test runner (Mocha, Jest, or even a simple Node.js script) so tests can be re-run easily.

4. **Document as you go:** Don't leave documentation for the end. Update `SETUP_GUIDE.md` every time you discover a setup step.

5. **Be the bug reporter:** When you find an issue in someone else's component, document it clearly:
   - What you did
   - What you expected
   - What actually happened
   - Steps to reproduce

---

## 📚 Resources

- [Mocha test framework](https://mochajs.org/)
- [Chai assertion library](https://www.chaijs.com/)
- [snarkjs testing patterns](https://github.com/iden3/snarkjs#testing)
- [Mermaid diagram syntax](https://mermaid.js.org/syntax/flowchart.html)

---

*Last updated: 2026-10-24*
