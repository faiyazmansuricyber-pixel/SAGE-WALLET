# Tufel — Circuit & Cryptography Brief

> **Role:** Circom circuit, proof generation, cryptographic integration
> **Primary directories:** `circuits/`, `scripts/`, `shared/`

---

## 🎯 Your Mission

You are the cryptographic foundation of ProofPass. Everything else depends on your circuit and its compiled outputs. **You go first.**

---

## 📋 What You Must Build

### 1. The Circom Circuit (`circuits/scholarship.circom`)

A Groth16-compatible circuit that proves:
1. **Income eligibility:** `income < threshold` (threshold = 300000)
2. **Credential authenticity:** The credential was signed by the issuer (EdDSA signature verification over BabyJubJub)

**Required signals** (see `docs/INTERFACE_CONTRACT.md` §2 for full details):

| Signal | Type | Visibility |
|---|---|---|
| `income` | Private input | ❌ |
| `signature[2]` | Private input | ❌ |
| `credentialHash` | Private input | ❌ |
| `threshold` | Public input | ✅ |
| `issuerPubKey[2]` | Public input | ✅ |
| `eligible` | Output | ✅ |

> [!IMPORTANT]
> Use `circomlib` components for EdDSA verification and comparison. Do NOT write your own elliptic curve arithmetic.

### 2. Issuer Key Generation Script (`scripts/generate_keys.js`)

- Generate an EdDSA keypair on BabyJubJub
- Save the **private key** to `shared/issuer_keys/private_key.json` (gitignored in production, included for demo)
- Save the **public key** to `shared/issuer_keys/public_key.json`

### 3. Credential Signing Script (`scripts/generate_credential.js`)

- Create a sample credential (fictional student data)
- Hash the credential subject fields
- Sign the hash with the issuer's private key
- Output `shared/sample_credential.json` matching the format in `docs/INTERFACE_CONTRACT.md` §1

### 4. Trusted Setup Script (`scripts/setup.sh` or `scripts/setup.js`)

- Compile the circuit: `circom scholarship.circom --r1cs --wasm --sym -o build/`
- Run Powers of Tau ceremony (for demo, use `snarkjs powersoftau new bn128 12`)
- Generate proving key and verification key
- Export `Verifier.sol` to `contracts/`
- Output all artifacts to the locations specified in `docs/INTERFACE_CONTRACT.md` §2

### 5. Proof Generation Script (`scripts/generate_proof.js`)

- Load the credential and issuer keys
- Prepare circuit input signals
- Generate a proof using `snarkjs.groth16.fullProve()`
- Verify the proof locally using `snarkjs.groth16.verify()`
- Save `proof.json` and `public.json` for testing

---

## 📦 Files You Own

```
circuits/
├── scholarship.circom          ← The main circuit
├── build/                      ← Compiled outputs (wasm, r1cs, sym)
│   ├── scholarship.wasm
│   ├── scholarship.r1cs
│   └── scholarship.sym
└── input/
    └── input.json              ← Sample input for testing

scripts/
├── generate_keys.js            ← Issuer keypair generation
├── generate_credential.js      ← Sample credential creation + signing
├── setup.sh (or setup.js)      ← Circuit compilation + trusted setup
└── generate_proof.js           ← Proof generation + local verification

shared/
├── sample_credential.json      ← Signed sample credential
├── issuer_keys/
│   ├── private_key.json        ← Issuer private key (demo only)
│   └── public_key.json         ← Issuer public key
├── proving_key.zkey            ← Proving key (from trusted setup)
└── verification_key.json       ← Verification key
```

> [!CAUTION]
> **Do not modify** files in `contracts/` (except the auto-generated `Verifier.sol`), `frontend/`, or `test/`. Those belong to other team members.

---

## 🔗 Your Handoffs

Once your artifacts are ready, **log the handoff** in `docs/HANDOFF_LOG.md` and notify:

| Artifact | Goes To | Why They Need It |
|---|---|---|
| `circuits/build/scholarship.wasm` | Faiyaz | Proof generation in browser |
| `shared/proving_key.zkey` | Faiyaz | Proof generation in browser |
| `shared/verification_key.json` | Faiyaz, Kaif | Frontend verification + contract testing |
| `contracts/Verifier.sol` | Kaif | Deploy and wrap in ScholarshipVerifier |
| `shared/sample_credential.json` | Faiyaz, Heet | Frontend demo + test cases |
| `shared/issuer_keys/public_key.json` | Everyone | Public input to the circuit |

---

## 🧪 Self-Tests Before Handoff

Before marking your work as done, verify:

- [ ] Circuit compiles without errors: `circom scholarship.circom --r1cs --wasm --sym -o build/`
- [ ] Trusted setup completes: `proving_key.zkey` and `verification_key.json` exist
- [ ] Valid credential (income < 300000) → proof generated → local verification passes
- [ ] Invalid credential (income ≥ 300000) → circuit outputs `eligible = 0`
- [ ] Tampered credential (wrong hash) → circuit fails witness generation
- [ ] `Verifier.sol` is generated and placed in `contracts/`
- [ ] `public.json` signal order is documented in `INTERFACE_CONTRACT.md`

---

## 📚 Resources

- [Circom documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [circomlib (EdDSA, Comparators, etc.)](https://github.com/iden3/circomlib)
- [BabyJubJub curve](https://eips.ethereum.org/EIPS/eip-2494)

---

## ⚠️ Common Pitfalls

1. **Signal ordering:** The order of public signals in `public.json` depends on declaration order in the circuit. Document it immediately after first compilation.
2. **Field size:** BN128 field prime is ~254 bits. Income values (up to ~10^6) fit easily, but be careful with hash values.
3. **Trusted setup:** For demo purposes, a simple ceremony is fine. Don't use `powersoftau new bn128 28` — it takes too long. `12` is sufficient for small circuits.
4. **circomlib version:** Pin the version in `package.json` to avoid breaking changes.

---

*Last updated: 2026-10-24*
