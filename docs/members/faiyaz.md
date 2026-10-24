# Faiyaz — Frontend Brief

> **Role:** Frontend and user interaction
> **Primary directory:** `frontend/`

---

## 🎯 Your Mission

Build a clean, intuitive web interface where a student can:
1. Load their signed credential
2. Generate a genuine zero-knowledge proof in the browser
3. See whether they are **ELIGIBLE** or **REJECTED** — without revealing their income

---

## 📋 What You Must Build

### 1. Main Page (`frontend/index.html` + `frontend/app.js` + `frontend/style.css`)

A single-page application with these sections:

#### Section A: Credential Input
- File upload or paste area for the student's `credential.json`
- "Generate Proof" button
- Display parsed credential summary (name, institution — **never** show income)

#### Section B: Proof Generation & Verification
- Loading spinner while generating proof ("Generating zero-knowledge proof…")
- Local verification using `snarkjs.groth16.verify()`
- Display result using the exact UI states from `docs/INTERFACE_CONTRACT.md` §5

#### Section C: Result Display

| State | Display | Color |
|---|---|---|
| Before proof | "Upload your credential to check eligibility" | Neutral / Gray |
| Generating | Spinner + "Generating zero-knowledge proof…" | Blue |
| Eligible | "✅ ELIGIBLE — Proof verified" | Green |
| Rejected | "❌ REJECTED — Income above threshold" | Red |
| Invalid | "⚠️ INVALID — Proof verification failed" | Orange |
| Error | Descriptive error message | Red |

> [!CAUTION]
> The UI must **NEVER** display:
> - The student's exact income
> - The credential hash
> - The signature
> - Any private circuit input

### 2. Proof Generation Logic (`frontend/app.js`)

```javascript
// Use snarkjs in the browser
// Required files from Tufel:
const WASM_PATH = "../circuits/build/scholarship.wasm";
const ZKEY_PATH = "../shared/proving_key.zkey";
const VKEY_PATH = "../shared/verification_key.json";

async function generateAndVerifyProof(credential) {
    // 1. Parse credential
    // 2. Prepare input signals (match circuit interface exactly)
    // 3. Generate proof: snarkjs.groth16.fullProve(input, WASM, ZKEY)
    // 4. Verify proof: snarkjs.groth16.verify(vkey, publicSignals, proof)
    // 5. Return result object (see INTERFACE_CONTRACT.md §6)
}
```

> [!IMPORTANT]
> Include `snarkjs` via CDN or bundle it:
> ```html
> <script src="https://cdn.jsdelivr.net/npm/snarkjs@0.7.5/build/snarkjs.min.js"></script>
> ```

---

## 📦 Files You Own

```
frontend/
├── index.html                  ← Main page structure
├── app.js                      ← Proof generation + UI logic
├── style.css                   ← Styling
└── assets/                     ← Any images, icons, etc.
```

> [!CAUTION]
> Do not modify files in `circuits/`, `scripts/`, `contracts/`, or `shared/`. Those belong to other team members.

---

## 🔗 What You Need From Others

| Artifact | From | What It Is | Status |
|---|---|---|---|
| `circuits/build/scholarship.wasm` | Tufel | Circuit WASM for proof generation | ⏳ Waiting |
| `shared/proving_key.zkey` | Tufel | Proving key for proof generation | ⏳ Waiting |
| `shared/verification_key.json` | Tufel | Verification key for local verify | ⏳ Waiting |
| `shared/sample_credential.json` | Tufel | Demo credential for testing | ⏳ Waiting |
| Input signal format documentation | Tufel | Exact JSON shape for circuit inputs | ⏳ Waiting |
| Contract ABI (optional) | Kaif | If doing on-chain verification | ⏳ Waiting |

> [!WARNING]
> **Do not implement the proof generation logic until Tufel's artifacts are available.** Without the real `.wasm` and `.zkey` files, you cannot generate genuine proofs. Build the UI first with the proof logic as a clearly-marked placeholder:
> ```javascript
> // PLACEHOLDER — waiting for Tufel's circuit compilation outputs
> // Replace this with snarkjs.groth16.fullProve() when artifacts are ready
> ```

---

## 🔗 Your Handoffs

| Artifact | Goes To | Why They Need It |
|---|---|---|
| Working frontend | Heet | Integration testing and demo |
| UI screenshots / walkthrough | Heet | Documentation and presentation |

---

## 🧪 Self-Tests Before Handoff

- [ ] UI loads without errors in a modern browser
- [ ] Credential file upload works
- [ ] Student's income is **never** displayed anywhere in the UI
- [ ] Valid credential → proof generated → "ELIGIBLE" displayed
- [ ] Income above threshold → "REJECTED" displayed
- [ ] Tampered credential → "INVALID" or error displayed
- [ ] Loading spinner appears during proof generation
- [ ] Error messages are clear and helpful
- [ ] Page is responsive (works on mobile-ish widths)

---

## 💡 Implementation Tips

1. **Start with the UI shell:** Build the HTML/CSS layout and all visual states first. Use static data to test each display state before integrating real crypto.

2. **snarkjs in the browser:** snarkjs works client-side. The `.wasm` and `.zkey` files can be large — consider showing a loading indicator while they download.

3. **File paths:** When serving locally, use a simple HTTP server (not `file://` protocol):
   ```bash
   # From the project root
   npx serve .
   # or
   python -m http.server 8080
   ```

4. **Credential parsing:** Validate the credential JSON structure before passing it to the circuit. Show user-friendly errors for malformed files.

5. **Keep it simple:** A clean, single-page design is better than a complex multi-page app. Focus on the core flow.

---

## 📚 Resources

- [snarkjs browser usage](https://github.com/iden3/snarkjs#in-the-browser)
- [MDN File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
- [CSS Grid](https://css-tricks.com/snippets/css/complete-guide-grid/)

---

*Last updated: 2026-10-24*
