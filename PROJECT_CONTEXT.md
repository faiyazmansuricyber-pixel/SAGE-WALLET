# ProofPass — Master Project Context

> **Read this entire file before writing any code.**
> This is the single source of truth for the ProofPass project.

---

## 1. What We Are Building

ProofPass is a **privacy-preserving scholarship eligibility verification system** using Zero-Knowledge Proofs (ZKPs).

A student must prove that their family income is **below ₹3,00,000** without revealing their exact income or exposing their private credential details to the verifier.

---

## 2. How It Works (End-to-End Flow)

```
┌──────────┐      credential.json       ┌──────────┐
│  ISSUER  │ ──────────────────────────▶ │ STUDENT  │
│ (script) │   (signed credential)       │ (browser)│
└──────────┘                             └────┬─────┘
                                              │
                                         generates ZKP
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │   VERIFIER   │
                                      │  (Solidity   │
                                      │   contract)  │
                                      └──────┬───────┘
                                             │
                                   ELIGIBLE / REJECTED
                                   (no income revealed)
```

1. **Issuer:** Creates and digitally signs a sample scholarship credential.
2. **Student:** Generates a genuine zero-knowledge proof in the browser or local application.
3. **Verifier:** Checks that the credential is authentic and the income condition is satisfied.
4. **Result:** Displays **ELIGIBLE** or **REJECTED** without revealing the student's exact income.

> [!CAUTION]
> The proof must be cryptographically real. **Never simulate** proof generation or verification.

---

## 3. Essential Technical Requirements

| Tool / Library | Purpose |
|---|---|
| **Circom** | Define the zero-knowledge circuit |
| **snarkjs** | Generate proofs and verify them |
| **Solidity** | Integrate the generated verifier contract |
| **Remix IDE** | Compile and test Solidity locally |
| **HTML / CSS / JavaScript** | Build the user interface |
| **GitHub** | Store and coordinate shared code |

Use free, open-source tools wherever possible. Start with **local testing**; public blockchain deployment is **not required** for the first working prototype.

---

## 4. Security Requirements

- The circuit **must verify** the issuer's signature and the income eligibility condition.
- The student must **not** be able to create an accepted credential merely by changing the income value.
- Public inputs must **not** contain the student's exact income or identity.
- Invalid proofs and tampered credentials must be **rejected**.
- Do **not** claim complete privacy or security without testing what the public inputs, transactions, and logs reveal.
- Use **fictional student data** only.

---

## 5. Team Ownership

| Member | Responsibility | Primary Directory |
|---|---|---|
| **Tufel** | Circom circuit, proof generation, cryptographic integration | `circuits/`, `scripts/` |
| **Kaif** | Solidity verifier integration and contract testing | `contracts/`, `test/` |
| **Faiyaz** | Frontend and user interaction | `frontend/` |
| **Heet** | Test cases, integration checks, documentation & presentation | `test/`, `docs/` |

> [!IMPORTANT]
> Each member must work **only** on their assigned files unless the team lead explicitly approves a change. Read your member-specific brief in `docs/members/` before starting.

---

## 6. Rules for the Coding Agent

Before editing:

1. Read **this entire project context**.
2. Inspect the existing repository and understand the current implementation.
3. Identify your assigned responsibility from the table above.
4. Read your **member-specific brief** in `docs/members/<your-name>.md`.
5. Read the **shared interface contract** in `docs/INTERFACE_CONTRACT.md`.
6. List the files you intend to create or modify.
7. **Do not overwrite** another member's work or change shared interfaces without approval.
8. Explain dependencies and required handoffs **before** implementing them.
9. Write beginner-friendly code with **clear comments**.
10. **Never claim a test passed** unless it was actually executed.
11. If a required component is missing, create a clearly labelled **placeholder** and explain the dependency. **Never replace cryptography with mock verification.**

---

## 7. Definition of Done

The prototype is complete **only** when:

- [x] A valid, issuer-authenticated credential produces a genuine proof and passes verification.
- [x] An income above the threshold fails eligibility.
- [x] A tampered credential or invalid proof is rejected.
- [x] The UI displays the result correctly.
- [x] No exact income or identity is disclosed to the verifier.
- [x] The team can demonstrate and explain the complete flow.

**Build the smallest working end-to-end prototype first.** Add features only after the core flow passes its tests.

---

## 8. Directory Structure

```
jaipur/
├── PROJECT_CONTEXT.md          ← You are here (master context)
├── docs/
│   ├── INTERFACE_CONTRACT.md   ← Shared data formats & API contract
│   ├── HANDOFF_LOG.md          ← Track component handoffs between members
│   └── members/
│       ├── tufel.md            ← Tufel's brief (circuits & crypto)
│       ├── kaif.md             ← Kaif's brief (Solidity & contracts)
│       ├── faiyaz.md           ← Faiyaz's brief (frontend)
│       └── heet.md             ← Heet's brief (testing & docs)
├── circuits/                   ← Tufel: Circom circuits
│   └── (scholarship.circom, etc.)
├── scripts/                    ← Tufel: Trusted setup & proof generation scripts
│   └── (setup.sh, generate_proof.js, etc.)
├── contracts/                  ← Kaif: Solidity verifier contracts
│   └── (ScholarshipVerifier.sol, etc.)
├── frontend/                   ← Faiyaz: UI files
│   └── (index.html, app.js, style.css, etc.)
├── test/                       ← Kaif + Heet: Test cases
│   └── (circuit_tests.js, contract_tests.js, integration_tests.js, etc.)
├── shared/                     ← Shared artifacts (keys, sample credentials)
│   ├── sample_credential.json
│   ├── issuer_keys/
│   └── verification_key.json
└── package.json                ← Project dependencies
```

---

## 9. Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd jaipur

# 2. Install dependencies (once package.json is populated)
npm install

# 3. Read your member brief
#    docs/members/<your-name>.md

# 4. Read the interface contract
#    docs/INTERFACE_CONTRACT.md

# 5. Start building in your assigned directory
```

---

*Last updated: 2026-10-24*
