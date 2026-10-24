import React, { useState } from "react";
import { parseEther, encodeFunctionData } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { publicClient } from "../client";
import { CONTRACT_ADDRESSES, WALLET_ABI, formatEth } from "../constants";
import { buildAndSubmitUserOp, PackedUserOp } from "../userop";
import { AttackResult, AgentAttempt } from "../types";

interface AttackLabProps {
  dailyLimit: bigint;
  spentToday: bigint;
  onRefreshPolicy: () => void;
  onNewAttempt: (attempt: AgentAttempt) => void;
  addToast: (type: "success" | "error" | "pending", title: string, message?: string) => void;
}

export const AttackLab: React.FC<AttackLabProps> = ({
  dailyLimit,
  spentToday,
  onRefreshPolicy,
  onNewAttempt,
  addToast,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [results, setResults] = useState<AttackResult[]>([]);
  const [totalLoss, setTotalLoss] = useState<bigint>(0n);

  const runAllAttacks = async () => {
    setIsRunning(true);
    setResults([]);
    setTotalLoss(0n);
    setCurrentStep(0);
    addToast("pending", "Attack Lab Started", "Executing 7 real attack vectors sequentially against Sentinel Wallet...");

    const attackList: AttackResult[] = [];
    let cumulativeLoss = 0n;
    let lastSucceededOp: PackedUserOp | null = null;

    try {
      // -------------------------------------------------------------
      // ATTACK 1: Pay unknown recipient 0.1 ETH
      // -------------------------------------------------------------
      setCurrentStep(1);
      const unknownRecipient = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
      const bal1Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const res1 = await buildAndSubmitUserOp({
        target: unknownRecipient,
        value: parseEther("0.1"),
        data: "0x",
      });
      const bal1After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const loss1 = bal1Before > bal1After ? bal1Before - bal1After : 0n;
      cumulativeLoss += loss1;

      attackList.push({
        id: 1,
        name: "1. Unknown Recipient",
        description: "Attempt payment of 0.1 ETH to unapproved address (0x...dEaD)",
        status: res1.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
        loss: loss1,
        reason: res1.reason || (res1.status === "EXECUTED" ? "Bypassed allowlist!" : "RECIPIENT_NOT_ALLOWED"),
        txHash: res1.txHash,
      });
      setResults([...attackList]);
      if (res1.signedOp && res1.status === "EXECUTED") lastSucceededOp = res1.signedOp;

      // -------------------------------------------------------------
      // ATTACK 2: Pay allowed recipient more than per-tx limit
      // -------------------------------------------------------------
      setCurrentStep(2);
      const onChainPerTx = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "perTxLimit",
        args: [],
      } as any)) as bigint;

      const exceedAmount = onChainPerTx + 1n; // perTxLimit + 1 wei
      const bal2Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const res2 = await buildAndSubmitUserOp({
        target: CONTRACT_ADDRESSES.goodRecipient,
        value: exceedAmount,
        data: "0x",
      });
      const bal2After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const loss2 = bal2Before > bal2After ? bal2Before - bal2After : 0n;
      cumulativeLoss += loss2;

      attackList.push({
        id: 2,
        name: "2. Exceed Per-Tx Limit",
        description: `Attempt payment of perTxLimit + 1 wei (${formatEth(exceedAmount, 4)} ETH) to allowed recipient`,
        status: res2.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
        loss: loss2,
        reason: res2.reason || (res2.status === "EXECUTED" ? "Limit exceeded without revert!" : "PERTX_LIMIT"),
        txHash: res2.txHash,
      });
      setResults([...attackList]);
      if (res2.signedOp && res2.status === "EXECUTED") lastSucceededOp = res2.signedOp;

      // -------------------------------------------------------------
      // ATTACK 3: Drain loop: pay allowed recipient perTxLimit repeatedly until blocked
      // -------------------------------------------------------------
      setCurrentStep(3);
      // Check current day's spent
      const block = await publicClient.getBlock();
      const day = BigInt(Math.floor(Number(block.timestamp) / 86400));
      const currentSpent = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.wallet,
        abi: WALLET_ABI,
        functionName: "spentOnDay",
        args: [day],
      })) as bigint;

      if (currentSpent >= dailyLimit) {
        attackList.push({
          id: 3,
          name: "3. Rapid Drain Loop",
          description: "Drain loop: 0 tries succeeded (0 ETH moved) - budget exhausted",
          status: "SKIPPED",
          loss: 0n,
          reason: "skipped: budget used",
        });
      } else {
        const bal3Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
        let loopLoss = 0n;
        let lastReason = "";
        let succeededTries = 0;

        for (let i = 0; i < 8; i++) {
          const res = await buildAndSubmitUserOp({
            target: CONTRACT_ADDRESSES.goodRecipient,
            value: onChainPerTx,
            data: "0x",
          });

          if (res.status === "EXECUTED") {
            succeededTries++;
            if (res.signedOp) lastSucceededOp = res.signedOp;
          } else {
            lastReason = res.reason || "DAILY_LIMIT";
            break;
          }
        }

        const bal3After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
        loopLoss = bal3Before > bal3After ? bal3Before - bal3After : 0n;
        cumulativeLoss += loopLoss;

        attackList.push({
          id: 3,
          name: "3. Rapid Drain Loop",
          description: `Drain loop: ${succeededTries} ${succeededTries === 1 ? "try" : "tries"} succeeded (${formatEth(loopLoss, 4)} ETH moved)`,
          status: succeededTries > 0 && loopLoss === 0n ? "SKIPPED" : "BLOCKED",
          loss: loopLoss,
          reason: lastReason || (succeededTries === 0 ? "skipped: budget used" : "DAILY_LIMIT"),
        });
      }
      setResults([...attackList]);

      // -------------------------------------------------------------
      // ATTACK 4: Call the wallet itself: agentExecute(target = wallet) setPolicy
      // -------------------------------------------------------------
      setCurrentStep(4);
      const maliciousCalldata = encodeFunctionData({
        abi: WALLET_ABI,
        functionName: "setPolicy",
        args: [parseEther("100"), parseEther("100"), Math.floor(Date.now() / 1000) + 864000],
      });

      const bal4Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const res4 = await buildAndSubmitUserOp({
        target: CONTRACT_ADDRESSES.wallet,
        value: 0n,
        data: maliciousCalldata,
      });
      const bal4After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const loss4 = bal4Before > bal4After ? bal4Before - bal4After : 0n;
      cumulativeLoss += loss4;

      attackList.push({
        id: 4,
        name: "4. Wallet Self-Call Privilege Escalation",
        description: "Agent attempts to call wallet itself to hijack setPolicy(100 ETH, 100 ETH)",
        status: res4.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
        loss: loss4,
        reason: res4.reason || (res4.status === "EXECUTED" ? "Privilege escalation succeeded!" : "TARGET_FORBIDDEN"),
        txHash: res4.txHash,
      });
      setResults([...attackList]);

      // -------------------------------------------------------------
      // ATTACK 5: Target EntryPoint with 1 ETH
      // -------------------------------------------------------------
      setCurrentStep(5);
      const bal5Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const res5 = await buildAndSubmitUserOp({
        target: CONTRACT_ADDRESSES.entryPoint,
        value: parseEther("1"),
        data: "0x",
      });
      const bal5After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const loss5 = bal5Before > bal5After ? bal5Before - bal5After : 0n;
      cumulativeLoss += loss5;

      attackList.push({
        id: 5,
        name: "5. EntryPoint Target Exploit",
        description: "Agent attempts direct payment / interaction targeting the EntryPoint contract",
        status: res5.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
        loss: loss5,
        reason: res5.reason || (res5.status === "EXECUTED" ? "EntryPoint targeted successfully!" : "TARGET_FORBIDDEN"),
        txHash: res5.txHash,
      });
      setResults([...attackList]);

      // -------------------------------------------------------------
      // ATTACK 6: UserOp signed by random different key
      // -------------------------------------------------------------
      setCurrentStep(6);
      const randomKey = generatePrivateKey();
      const bal6Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const res6 = await buildAndSubmitUserOp({
        target: CONTRACT_ADDRESSES.goodRecipient,
        value: parseEther("0.01"),
        data: "0x",
        signerKey: randomKey,
      });
      const bal6After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
      const loss6 = bal6Before > bal6After ? bal6Before - bal6After : 0n;
      cumulativeLoss += loss6;

      attackList.push({
        id: 6,
        name: "6. Hijacked Key / Rogue Signer",
        description: "UserOp signed by an unauthorized random private key",
        status: res6.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
        loss: loss6,
        reason: res6.reason || (res6.status === "EXECUTED" ? "Rogue signature accepted!" : "Blocked: signature invalid (agent revoked or wrong key)"),
        txHash: res6.txHash,
      });
      setResults([...attackList]);

      // -------------------------------------------------------------
      // ATTACK 7: Replay attack (resend exact same signed UserOp)
      // -------------------------------------------------------------
      setCurrentStep(7);
      let opToReplay = lastSucceededOp;

      if (!opToReplay) {
        const miniRes = await buildAndSubmitUserOp({
          target: CONTRACT_ADDRESSES.goodRecipient,
          value: 1n,
          data: "0x",
        });
        if (miniRes.status === "EXECUTED" && miniRes.signedOp) {
          opToReplay = miniRes.signedOp;
        }
      }

      if (opToReplay) {
        const bal7Before = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
        const res7 = await buildAndSubmitUserOp({
          target: opToReplay.sender,
          value: 0n,
          replayOp: opToReplay,
        });
        const bal7After = await publicClient.getBalance({ address: CONTRACT_ADDRESSES.wallet });
        const loss7 = bal7Before > bal7After ? bal7Before - bal7After : 0n;
        cumulativeLoss += loss7;

        attackList.push({
          id: 7,
          name: "7. UserOp Nonce Replay Attack",
          description: "Resubmit exact previous signed UserOp that already succeeded",
          status: res7.status === "EXECUTED" ? "SUCCEEDED" : "BLOCKED",
          loss: loss7,
          reason: res7.reason || (res7.status === "EXECUTED" ? "Replay succeeded!" : "AA25 invalid account nonce / already executed"),
          txHash: res7.txHash,
        });
      } else {
        attackList.push({
          id: 7,
          name: "7. UserOp Nonce Replay Attack",
          description: "Resubmit exact previous signed UserOp",
          status: "SKIPPED",
          loss: 0n,
          reason: "skipped: budget used (no valid executed op available to replay)",
        });
      }
      setResults([...attackList]);

      setTotalLoss(cumulativeLoss);
      onRefreshPolicy();
      addToast(
        cumulativeLoss <= dailyLimit ? "success" : "error",
        "Attack Lab Completed",
        `Total loss: ${formatEth(cumulativeLoss, 4)} ETH against daily limit: ${formatEth(dailyLimit, 4)} ETH`
      );
    } catch (labErr: any) {
      addToast("error", "Attack Lab Interrupted", labErr.message || String(labErr));
    } finally {
      setIsRunning(false);
      setCurrentStep(0);
    }
  };

  const isPass = totalLoss <= dailyLimit;
  const lossPercentage =
    dailyLimit > 0n ? Math.min(100, Number((totalLoss * 100n) / dailyLimit)) : 0;

  return (
    <section className="dashboard-card attack-lab-panel" id="attack-lab">
      <div className="card-header">
        <div>
          <h2 className="card-title">Attack Lab (real on-chain attempts)</h2>
          <p className="card-subtitle">
            Assume the AI agent is compromised or hijacked. Test 7 live attack vectors and measure real loss.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-danger"
            id="btn-run-attacks"
            disabled={isRunning}
            onClick={runAllAttacks}
          >
            {isRunning ? (
              <>
                <span className="spinner"></span> Running Attack {currentStep}/7...
              </>
            ) : (
              "Run 7 attacks"
            )}
          </button>
        </div>
      </div>

      {/* Honest Constraint Notice */}
      <div className="lab-notice-box">
        <span className="notice-icon">i</span>
        <span className="notice-text">
          Daily window is a fixed UTC day, so at the midnight boundary up to 2x the limit is possible.
          Owner-approved calls are excluded.
        </span>
      </div>

      {/* Summary Box */}
      {results.length > 0 && (
        <div className="attack-summary-card">
          <div className="summary-header">
            <div className="summary-title-group">
              <span className="text-sm font-semibold">Total Loss Assessment:</span>
              <span className="font-mono text-lg font-bold">
                {formatEth(totalLoss, 4)} ETH / {formatEth(dailyLimit, 4)} ETH Limit
              </span>
            </div>
            <span className={`badge badge-lg ${isPass ? "badge-green" : "badge-red"}`}>
              {isPass ? "PASS (Bounded by Policy)" : "FAIL (Limit Breached)"}
            </span>
          </div>

          <div className="summary-progress-bar-bg">
            <div
              className={`summary-progress-bar-fill ${isPass ? "fill-green" : "fill-red"}`}
              style={{ width: `${lossPercentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Attacks Results Table */}
      <div className="attacks-table-wrapper">
        <table className="attacks-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Attack Vector</th>
              <th>Target & Intent</th>
              <th>Outcome</th>
              <th>ETH Loss</th>
              <th>Revert / Error Reason</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Click &quot;Run 7 attacks&quot; to execute real sequential exploits against the smart wallet.
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr key={r.id} className={`attack-row-${r.status.toLowerCase()}`}>
                  <td className="font-mono text-xs">{r.id}</td>
                  <td className="font-semibold text-sm">{r.name}</td>
                  <td className="text-xs text-muted max-w-xs">{r.description}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "BLOCKED"
                          ? "badge-green"
                          : r.status === "SUCCEEDED"
                          ? "badge-red"
                          : "badge-amber"
                      }`}
                    >
                      {r.status === "BLOCKED" ? "BLOCKED (Safe)" : r.status === "SUCCEEDED" ? "BREACHED" : "SKIPPED"}
                    </span>
                  </td>
                  <td className="font-mono text-xs font-semibold">
                    {r.loss > 0n ? (
                      <span className="text-amber">-{formatEth(r.loss, 4)} ETH</span>
                    ) : (
                      <span className="text-muted">0 ETH</span>
                    )}
                  </td>
                  <td className="font-mono text-xs max-w-sm">
                    <span className={r.status === "BLOCKED" ? "text-emerald" : "text-red"}>
                      {r.reason}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
