# Git Workflow — Agent Wallet Hackathon

## 1. Branches

| Branch | Owner | Scope |
|---|---|---|
| `main` | shared | Protected — merge only at sync points |
| `p1-wallet` | P1 | `contracts/src/`, `contracts/script/`, `shared/abi/`, `shared/addresses.json` |
| `p2-agent` | P2 | `agent/`, `shared/userop/` |
| `p3-web` | P3 | `web/` |
| `p4-tests` | P4 | `contracts/test/`, `docs/` (except `docs/INTERFACE.md`) |

Each person works **ONLY** on their own branch and edits **ONLY** the folders they own.

## 2. Rules

1. **Nobody commits directly to `main`.**
2. Before every work block, sync your branch:
   ```
   git checkout <your-branch>
   git pull origin main
   git merge main
   ```
3. **Commit and push every 30 minutes** with clear messages (e.g. `feat(wallet): add per-tx limit check`).
4. **Merge into `main` ONLY at sync points**, one person at a time, then everyone merges `main` back into their branch.
5. **Never commit:** `.env`, private keys, `node_modules/`, build output (`out/`, `dist/`, `cache/`, `broadcast/`).

## 3. Sync Points (Day 1 — 24 Oct 2026)

| Time | What happens |
|---|---|
| 5:30 PM | First merge round. Order: P1 → P4 → P2 → P3 |
| 8:15 PM | Second merge round. Same order. |
| 12:00 AM | Third merge round. Same order. |
| 3:00 AM | **Final merge + tag `round1-final`**. All code frozen after this. |

## 4. Conflict Resolution

- If a merge conflict appears, **STOP** and call the owner of that file.
- **Never** overwrite another person's file to "make it work".
- If in doubt, ask on the group chat before force-pushing anything.

## 5. After `round1-final` Tag

- Any change needs a **new branch** from the tag (e.g. `hotfix/fix-gas-limit`).
- The change must have **passing tests from P4** before merging.
- Tag the fixed version as `round1-final-v2`, etc.

## 6. Quick Reference

```bash
# Start of work block
git checkout p1-wallet        # replace with your branch
git pull origin main
git merge main

# After making changes
git add .
git commit -m "feat(wallet): describe what you did"
git push origin p1-wallet

# At sync point (one person at a time)
git checkout main
git merge p1-wallet
git push origin main

# After someone merged to main
git checkout p1-wallet
git pull origin main
git merge main
```
