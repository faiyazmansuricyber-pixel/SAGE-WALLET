const fs = require('fs');
const path = require('path');
const { createPublicClient, createWalletClient, http, encodeFunctionData, parseEther, formatEther, decodeErrorResult, decodeEventLog } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

// Read demo keys strictly from web/src/demoKeys.ts
const demoKeysRaw = fs.readFileSync(path.join(__dirname, 'src', 'demoKeys.ts'), 'utf8');
const ownerKeyMatch = demoKeysRaw.match(/DEMO_ONLY_OWNER_PRIVATE_KEY\s*=\s*["']([^"']+)["']/);
const agentKeyMatch = demoKeysRaw.match(/DEMO_ONLY_AGENT_PRIVATE_KEY\s*=\s*["']([^"']+)["']/);
if (!ownerKeyMatch || !agentKeyMatch) throw new Error('Failed to load keys from demoKeys.ts');
const ownerKey = ownerKeyMatch[1];
const agentKey = agentKeyMatch[1];

// Read addresses strictly from shared/addresses.json
const rawAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'addresses.json'), 'utf8'));
const epAddress = rawAddresses.entryPoint;
const walletAddress = rawAddresses.wallet;
const goodRecipient = rawAddresses.goodRecipient;
const deadRecipient = '0x000000000000000000000000000000000000dEaD';

const pc = createPublicClient({ transport: http('http://127.0.0.1:8545') });
const ownerAcc = privateKeyToAccount(ownerKey);
const agentAcc = privateKeyToAccount(agentKey);
const wcOwner = createWalletClient({ account: ownerAcc, transport: http('http://127.0.0.1:8545') });

const epAbi = [
  { name: 'getNonce', type: 'function', inputs: [{ name: 'sender', type: 'address' }, { name: 'key', type: 'uint192' }], outputs: [{ name: 'nonce', type: 'uint256' }], stateMutability: 'view' },
  { name: 'getUserOpHash', type: 'function', inputs: [{ name: 'userOp', type: 'tuple', internalType: 'struct PackedUserOperation', components: [
    { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
    { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' },
    { name: 'paymasterAndData', type: 'bytes' }, { name: 'signature', type: 'bytes' }
  ]}], outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view' },
  { name: 'handleOps', type: 'function', inputs: [
    { name: 'ops', type: 'tuple[]', internalType: 'struct PackedUserOperation[]', components: [
      { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
      { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' },
      { name: 'paymasterAndData', type: 'bytes' }, { name: 'signature', type: 'bytes' }
    ]},
    { name: 'beneficiary', type: 'address' }
  ], outputs: [], stateMutability: 'payable' },
  { name: 'FailedOp', type: 'error', inputs: [{ name: 'opIndex', type: 'uint256' }, { name: 'reason', type: 'string' }] },
  { name: 'FailedOpWithRevert', type: 'error', inputs: [{ name: 'opIndex', type: 'uint256' }, { name: 'reason', type: 'string' }, { name: 'inner', type: 'bytes' }] },
  { name: 'UserOperationRevertReason', type: 'event', inputs: [
    { name: 'userOpHash', type: 'bytes32', indexed: true },
    { name: 'sender', type: 'address', indexed: true },
    { name: 'nonce', type: 'uint256', indexed: false },
    { name: 'revertReason', type: 'bytes', indexed: false }
  ]}
];

const walletAbi = [
  { name: 'agentExecute', type: 'function', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'approveCall', type: 'function', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'expiry', type: 'uint48' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'revokeAgent', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'setAgent', type: 'function', inputs: [{ name: 'agent', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'Executed', type: 'event', inputs: [{ name: 'target', type: 'address', indexed: true }, { name: 'value', type: 'uint256', indexed: false }, { name: 'selector', type: 'bytes4', indexed: false }, { name: 'approved', type: 'bool', indexed: false }] }
];

const errorStringAbi = [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }];

function decodeRevert(err) {
  const full = String(err?.message || err);
  const cause = err?.cause || err;
  if (cause?.data?.errorName === 'FailedOp' || cause?.errorName === 'FailedOp') {
    const args = cause?.data?.args || cause?.args || [];
    const reason = String(args[1] || '');
    if (reason.includes('AA24') || reason.toLowerCase().includes('signature')) {
      return 'Blocked: signature invalid (agent revoked or wrong key)';
    }
    return reason;
  }
  if (cause?.data?.errorName === 'FailedOpWithRevert' || cause?.errorName === 'FailedOpWithRevert') {
    const args = cause?.data?.args || cause?.args || [];
    const innerBytes = args[2];
    if (innerBytes && innerBytes !== '0x') {
      try {
        const decoded = decodeErrorResult({ abi: errorStringAbi, data: innerBytes });
        return String(decoded.args[0]);
      } catch {
        return innerBytes;
      }
    }
    return String(args[1] || 'FailedOpWithRevert');
  }
  if (full.includes('AA24') || full.toLowerCase().includes('signature error')) {
    return 'Blocked: signature invalid (agent revoked or wrong key)';
  }
  return err.shortMessage || full;
}

async function sendUserOp({ target, value, data = '0x', signer = agentAcc, replayOp = null }) {
  let signedOp;
  let userOpHash;

  if (replayOp) {
    signedOp = replayOp;
    userOpHash = await pc.readContract({ address: epAddress, abi: epAbi, functionName: 'getUserOpHash', args: [signedOp] });
  } else {
    const nonce = await pc.readContract({ address: epAddress, abi: epAbi, functionName: 'getNonce', args: [walletAddress, 0n] });
    const callData = encodeFunctionData({ abi: walletAbi, functionName: 'agentExecute', args: [target, value, data] });
    const accountGasLimits = '0x' + (500000n).toString(16).padStart(32, '0') + (500000n).toString(16).padStart(32, '0');
    const gasFees = '0x' + (1000000000n).toString(16).padStart(32, '0') + (5000000000n).toString(16).padStart(32, '0');
    const unsignedOp = {
      sender: walletAddress,
      nonce,
      initCode: '0x',
      callData,
      accountGasLimits,
      preVerificationGas: 100000n,
      gasFees,
      paymasterAndData: '0x',
      signature: '0x'
    };
    userOpHash = await pc.readContract({ address: epAddress, abi: epAbi, functionName: 'getUserOpHash', args: [unsignedOp] });
    const signature = await signer.sign({ hash: userOpHash });
    signedOp = { ...unsignedOp, signature };
  }

  try {
    await pc.simulateContract({
      account: ownerAcc,
      address: epAddress,
      abi: epAbi,
      functionName: 'handleOps',
      args: [[signedOp], ownerAcc.address]
    });
  } catch (simErr) {
    return { status: 'BLOCKED', reason: decodeRevert(simErr), userOpHash, signedOp };
  }

  try {
    const txHash = await wcOwner.writeContract({
      address: epAddress,
      abi: epAbi,
      functionName: 'handleOps',
      args: [[signedOp], ownerAcc.address]
    });
    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === epAddress.toLowerCase()) {
        try {
          const parsed = decodeEventLog({ abi: epAbi, data: log.data, topics: log.topics });
          if (parsed.eventName === 'UserOperationRevertReason') {
            const raw = parsed.args.revertReason;
            let decoded = raw;
            try {
              const inner = decodeErrorResult({ abi: errorStringAbi, data: raw });
              decoded = inner.args[0];
            } catch {}
            return { status: 'BLOCKED', reason: decoded, txHash, userOpHash, signedOp };
          }
        } catch {}
      }
    }
    return { status: 'EXECUTED', txHash, userOpHash, signedOp };
  } catch (txErr) {
    return { status: 'BLOCKED', reason: decodeRevert(txErr), userOpHash, signedOp };
  }
}

async function runAcceptance() {
  console.log('=== RUNNING ACCEPTANCE TESTS A THROUGH G ===\n');

  // TEST A: Pay allowed 0.5 ETH -> GREEN, recipient balance +0.5
  console.log('--- TEST A: Pay allowed 0.5 ETH ---');
  const balBeforeA = await pc.getBalance({ address: goodRecipient });
  const resA = await sendUserOp({ target: goodRecipient, value: parseEther('0.5') });
  const balAfterA = await pc.getBalance({ address: goodRecipient });
  const diffA = formatEther(balAfterA - balBeforeA);
  console.log(`Status: ${resA.status}, Tx: ${resA.txHash}, Recipient Balance Diff: +${diffA} ETH`);
  console.log(`Result: ${resA.status === 'EXECUTED' && diffA === '0.5' ? 'PASS' : 'FAIL'}\n`);

  // TEST B: Pay unknown address -> RED, reason contains RECIPIENT_NOT_ALLOWED
  console.log('--- TEST B: Pay unknown address 0.1 ETH ---');
  const resB = await sendUserOp({ target: deadRecipient, value: parseEther('0.1') });
  console.log(`Status: ${resB.status}, Reason: ${resB.reason}`);
  console.log(`Result: ${resB.status === 'BLOCKED' && String(resB.reason).includes('RECIPIENT_NOT_ALLOWED') ? 'PASS' : 'FAIL'}\n`);

  // TEST C: Pay 2 ETH to allowed -> RED, reason contains PERTX_LIMIT
  console.log('--- TEST C: Pay 2 ETH to allowed recipient ---');
  const resC = await sendUserOp({ target: goodRecipient, value: parseEther('2') });
  console.log(`Status: ${resC.status}, Reason: ${resC.reason}`);
  console.log(`Result: ${resC.status === 'BLOCKED' && String(resC.reason).includes('PERTX_LIMIT') ? 'PASS' : 'FAIL'}\n`);

  // TEST D: Pay 1 ETH repeatedly -> GREEN until daily cap, then RED with DAILY_LIMIT
  console.log('--- TEST D: Pay 1 ETH repeatedly until daily cap ---');
  let countD = 0;
  let lastReasonD = '';
  for (let i = 1; i <= 5; i++) {
    const res = await sendUserOp({ target: goodRecipient, value: parseEther('1') });
    console.log(`Try #${i}: Status = ${res.status}, Reason/Tx = ${res.status === 'EXECUTED' ? res.txHash : res.reason}`);
    if (res.status === 'EXECUTED') countD++;
    else {
      lastReasonD = res.reason;
      break;
    }
  }
  console.log(`Count executed: ${countD}, Blocked with reason: ${lastReasonD}`);
  console.log(`Result: ${lastReasonD === 'DAILY_LIMIT' ? 'PASS' : 'FAIL'}\n`);

  // TEST E: After B: Approve exact call, Retry -> GREEN owner-approved; Retry again -> RED
  console.log('--- TEST E: Owner Approve and Retry ---');
  const expiry = Math.floor(Date.now() / 1000) + 600;
  const approveTx = await wcOwner.writeContract({
    address: walletAddress,
    abi: walletAbi,
    functionName: 'approveCall',
    args: [deadRecipient, parseEther('0.1'), '0x', expiry]
  });
  await pc.waitForTransactionReceipt({ hash: approveTx });
  console.log(`approveCall submitted: ${approveTx}`);

  const retry1 = await sendUserOp({ target: deadRecipient, value: parseEther('0.1') });
  console.log(`Retry #1: Status = ${retry1.status}, Tx = ${retry1.txHash}`);

  const retry2 = await sendUserOp({ target: deadRecipient, value: parseEther('0.1') });
  console.log(`Retry #2: Status = ${retry2.status}, Reason = ${retry2.reason}`);
  console.log(`Result: ${retry1.status === 'EXECUTED' && retry2.status === 'BLOCKED' ? 'PASS' : 'FAIL'}\n`);

  // TEST F: Revoke agent -> send -> RED (signature failure). Then restore agent.
  console.log('--- TEST F: Revoke Agent & Signature Failure ---');
  const revokeTx = await wcOwner.writeContract({
    address: walletAddress,
    abi: walletAbi,
    functionName: 'revokeAgent',
    args: []
  });
  await pc.waitForTransactionReceipt({ hash: revokeTx });
  console.log(`revokeAgent submitted: ${revokeTx}`);

  const resF = await sendUserOp({ target: goodRecipient, value: parseEther('0.01') });
  console.log(`Send after revoke: Status = ${resF.status}, Reason = ${resF.reason}`);

  const restoreTx = await wcOwner.writeContract({
    address: walletAddress,
    abi: walletAbi,
    functionName: 'setAgent',
    args: [agentAcc.address]
  });
  await pc.waitForTransactionReceipt({ hash: restoreTx });
  console.log(`setAgent restored: ${restoreTx}`);
  console.log(`Result: ${resF.status === 'BLOCKED' && String(resF.reason).includes('signature') ? 'PASS' : 'FAIL'}\n`);

  // TEST G: Attack Lab total loss <= daily limit
  console.log('--- TEST G: Attack Lab Total Loss <= Daily Limit ---');
  const dailyLimit = 3000000000000000000n; // 3 ETH
  const balBeforeG = await pc.getBalance({ address: walletAddress });
  
  // 1. Unknown recipient
  const a1 = await sendUserOp({ target: deadRecipient, value: parseEther('0.1') });
  // 2. Exceed perTxLimit
  const a2 = await sendUserOp({ target: goodRecipient, value: parseEther('1') + 1n });
  // 3. Drain loop
  const a3 = await sendUserOp({ target: goodRecipient, value: parseEther('1') });
  // 4. Rogue key
  const a4 = await sendUserOp({ target: goodRecipient, value: parseEther('0.01'), signer: privateKeyToAccount(generatePrivateKey()) });
  // 5. Replay retry1 op
  const a5 = await sendUserOp({ target: deadRecipient, value: parseEther('0.1'), replayOp: retry1.signedOp });

  const balAfterG = await pc.getBalance({ address: walletAddress });
  const labLoss = balBeforeG > balAfterG ? balBeforeG - balAfterG : 0n;
  console.log(`Lab Loss: ${formatEther(labLoss)} ETH, Daily Limit: ${formatEther(dailyLimit)} ETH`);
  console.log(`Result: ${labLoss <= dailyLimit ? 'PASS' : 'FAIL'}\n`);

  // Final on-chain state inspection
  const finalBal = await pc.getBalance({ address: walletAddress });
  const block = await pc.getBlock();
  const day = BigInt(Math.floor(Number(block.timestamp) / 86400));
  const spentTodayFinal = await pc.readContract({
    address: walletAddress,
    abi: [{ name: 'spentOnDay', type: 'function', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'spentOnDay',
    args: [day]
  });

  console.log('=== FINAL ON-CHAIN STATE ===');
  console.log(`Wallet Balance: ${formatEther(finalBal)} ETH`);
  console.log(`Spent Today: ${formatEther(spentTodayFinal)} ETH`);
}

runAcceptance().catch(console.error);
