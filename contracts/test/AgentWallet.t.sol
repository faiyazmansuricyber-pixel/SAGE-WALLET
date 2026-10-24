// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {MockMerchant} from "../src/MockMerchant.sol";
import {EntryPoint} from "@account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS, _parseValidationData} from "@account-abstraction/core/Helpers.sol";

contract AgentWalletTest is Test {
    EntryPoint public entryPoint;
    AgentWallet public wallet;
    MockMerchant public merchant;

    uint256 public ownerPrivateKey = 0xA11CE;
    address public owner;

    uint256 public agentPrivateKey = 0xB0B;
    address public agent;

    uint256 public attackerPrivateKey = 0xE11;
    address public attacker;

    uint256 public constant MAX_PER_TX = 0.05 ether;
    uint256 public constant DAILY_LIMIT = 0.1 ether;
    uint48 public validUntil;

    function setUp() public {
        owner = vm.addr(ownerPrivateKey);
        agent = vm.addr(agentPrivateKey);
        attacker = vm.addr(attackerPrivateKey);

        // Deploy EntryPoint
        entryPoint = new EntryPoint();

        // Deploy Wallet
        wallet = new AgentWallet(entryPoint, owner);

        // Deploy Merchant
        merchant = new MockMerchant();

        // Fund wallet and accounts
        vm.deal(address(wallet), 10 ether);
        vm.deal(owner, 10 ether);
        vm.deal(agent, 10 ether);
        vm.deal(attacker, 10 ether);

        // Deposit ETH to EntryPoint for the wallet
        vm.prank(owner);
        entryPoint.depositTo{value: 2 ether}(address(wallet));

        validUntil = uint48(block.timestamp + 7 days);

        // Configure Agent and Policy
        vm.prank(owner);
        wallet.setAgent(agent, AgentWallet.Policy({
            maxPerTx: MAX_PER_TX,
            dailyLimit: DAILY_LIMIT,
            validUntil: validUntil
        }));

        // Allow MockMerchant.buyCredits(uint256)
        vm.prank(owner);
        wallet.setAllowedTarget(address(merchant), MockMerchant.buyCredits.selector, true);
    }

<<<<<<< HEAD
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // Helper to build and sign UserOperation
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    // ─────────────────────────────────────────────────────────────────────────
    // Helper to build and sign UserOperation
    // ─────────────────────────────────────────────────────────────────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    function _buildUserOp(
        address sender,
        uint256 nonce,
        bytes memory callData,
        uint256 signerKey
    ) internal view returns (PackedUserOperation memory op) {
        op.sender = sender;
        op.nonce = nonce;
        op.callData = callData;
        // verificationGasLimit = 100000, callGasLimit = 200000
        op.accountGasLimits = bytes32((uint256(100000) << 128) | uint256(200000));
        op.preVerificationGas = 50000;
        // maxPriorityFeePerGas = 1 gwei, maxFeePerGas = 2 gwei
        op.gasFees = bytes32((uint256(1 gwei) << 128) | uint256(2 gwei));

        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);
    }

<<<<<<< HEAD
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // Basic Unit Tests
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    // ─────────────────────────────────────────────────────────────────────────
    // Basic Unit Tests
    // ─────────────────────────────────────────────────────────────────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    function test_OwnerConfiguration() public {
        assertEq(wallet.owner(), owner);
        assertEq(wallet.agent(), agent);

        AgentWallet.Policy memory p = wallet.getPolicy();
        assertEq(p.maxPerTx, MAX_PER_TX);
        assertEq(p.dailyLimit, DAILY_LIMIT);
        assertEq(p.validUntil, validUntil);

        assertTrue(wallet.isAllowedTarget(address(merchant), MockMerchant.buyCredits.selector));
    }

    function test_NonOwnerCannotSetAgent() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.setAgent(attacker, AgentWallet.Policy(1 ether, 1 ether, validUntil));
    }

    function test_NonOwnerCannotRevokeAgent() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.revokeAgent();
    }

    function test_OwnerDirectExecute() public {
        address recipient = makeAddr("ownerRecipient");
        uint256 balanceBefore = recipient.balance;

        vm.prank(owner);
        wallet.execute(recipient, 1 ether, "");

        assertEq(recipient.balance, balanceBefore + 1 ether);
    }

    function test_NonOwnerCannotDirectExecute() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotOwner.selector);
        wallet.execute(attacker, 1 ether, "");
    }

<<<<<<< HEAD
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // EntryPoint handleOps Integration Tests
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    // ─────────────────────────────────────────────────────────────────────────
    // EntryPoint handleOps Integration Tests
    // ─────────────────────────────────────────────────────────────────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    function test_AgentValidMerchantPaymentViaEntryPoint() public {
        bytes memory callData = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        entryPoint.handleOps(ops, payable(owner));

        assertEq(merchant.credits(address(wallet)), 10);
        assertEq(wallet.spentToday(), 0.01 ether);
    }

    function test_OwnerExecuteViaEntryPoint() public {
        address recipient = makeAddr("ownerOpRecipient");
        bytes memory callData = abi.encodeWithSelector(
            wallet.execute.selector,
            recipient,
            0.5 ether,
            ""
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            ownerPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        entryPoint.handleOps(ops, payable(owner));

        assertEq(recipient.balance, 0.5 ether);
    }

<<<<<<< HEAD
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // Security & Privilege Escalation Tests
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
=======
    // ─────────────────────────────────────────────────────────────────────────
    // Security & Privilege Escalation Tests
    // ─────────────────────────────────────────────────────────────────────────
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb

    function test_AgentCannotSignOwnerExecute() public {
        // Agent tries to call execute() using agent key
        bytes memory callData = abi.encodeWithSelector(
            wallet.execute.selector,
            attacker,
            1 ether,
            ""
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            agentPrivateKey // signed by agent, but execute requires owner!
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // EntryPoint reverts with FailedOp: AA24 signature error
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error"));
        entryPoint.handleOps(ops, payable(owner));
    }

    function test_AttackerCannotSignAgentExecute() public {
        bytes memory callData = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            attackerPrivateKey // attacker signature
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error"));
        entryPoint.handleOps(ops, payable(owner));
    }

    function test_AgentCannotModifyPolicyOrSelfAuthorize() public {
        // Agent tries to call setAgent on wallet
        bytes memory callData = abi.encodeWithSelector(
            wallet.setAgent.selector,
            agent,
            AgentWallet.Policy(100 ether, 100 ether, validUntil)
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // Signature validation rejects since setAgent is not signed by owner
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error"));
        entryPoint.handleOps(ops, payable(owner));
    }

    function test_AgentCannotExceedPerTxLimit() public {
        // Limit is 0.05 ether, agent tries 0.06 ether
        bytes memory callData = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.06 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 60)
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // EntryPoint executes but operation reverts inside executeAsAgent
        // UserOperationRevertReason is emitted
        vm.recordLogs();
        entryPoint.handleOps(ops, payable(owner));

        // Merchant credits should NOT have increased
        assertEq(merchant.credits(address(wallet)), 0);
        // Spent today should remain 0
        assertEq(wallet.spentToday(), 0);
    }

    function test_AgentCannotExceedDailyLimitAcrossMultipleTx() public {
        // 1st tx: 0.05 ether (succeeds)
        bytes memory callData1 = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.05 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 50)
        );

        PackedUserOperation memory op1 = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData1,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops1 = new PackedUserOperation[](1);
        ops1[0] = op1;
        entryPoint.handleOps(ops1, payable(owner));
        assertEq(wallet.spentToday(), 0.05 ether);

        // 2nd tx: 0.05 ether (succeeds, reaching daily limit 0.1 ether)
        bytes memory callData2 = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.05 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 50)
        );

        PackedUserOperation memory op2 = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData2,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops2 = new PackedUserOperation[](1);
        ops2[0] = op2;
        entryPoint.handleOps(ops2, payable(owner));
        assertEq(wallet.spentToday(), 0.1 ether);

        // 3rd tx: 0.01 ether (exceeds daily limit 0.1 ether -> reverts)
        bytes memory callData3 = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        PackedUserOperation memory op3 = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData3,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops3 = new PackedUserOperation[](1);
        ops3[0] = op3;
        entryPoint.handleOps(ops3, payable(owner));

        // Total credits purchased should be 100, not 110
        assertEq(merchant.credits(address(wallet)), 100);
        assertEq(wallet.spentToday(), 0.1 ether);
    }

    function test_DailyLimitResetsOnNextUTCDay() public {
        // Spend 0.1 ether today
        vm.prank(agent);
        wallet.executeAsAgent(
            address(merchant),
            0.05 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 50)
        );
        vm.prank(agent);
        wallet.executeAsAgent(
            address(merchant),
            0.05 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 50)
        );

        assertEq(wallet.spentToday(), 0.1 ether);

        // Warp time forward 1 UTC day
        vm.warp(block.timestamp + 1 days + 1);

        assertEq(wallet.spentToday(), 0);

        // Can spend again
        vm.prank(agent);
        wallet.executeAsAgent(
            address(merchant),
            0.04 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 40)
        );
        assertEq(wallet.spentToday(), 0.04 ether);
    }

    function test_AgentCannotCallUnapprovedTarget() public {
        address unapprovedTarget = makeAddr("unapprovedTarget");

        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAllowedTarget.selector);
        wallet.executeAsAgent(unapprovedTarget, 0.01 ether, hex"12345678");
    }

    function test_AgentCannotCallUnapprovedSelectorOnTarget() public {
        bytes4 unapprovedSelector = bytes4(keccak256("withdraw()"));

        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAllowedTarget.selector);
        wallet.executeAsAgent(address(merchant), 0.01 ether, abi.encodeWithSelector(unapprovedSelector));
    }

    function test_AgentCannotCallBlockedApprovalFunctions() public {
        bytes4 approveSelector = 0x095ea7b3; // approve(address,uint256)

        vm.prank(agent);
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(merchant), 0, abi.encodeWithSelector(approveSelector, attacker, 1000));
    }

    function test_AgentCannotCallSelfOrEntryPoint() public {
        vm.prank(agent);
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(wallet), 0, "");

        vm.prank(agent);
        vm.expectRevert(AgentWallet.ForbiddenCall.selector);
        wallet.executeAsAgent(address(entryPoint), 0, "");
    }

    function test_AgentCannotPayUnapprovedRecipientDirectly() public {
        address unapprovedRecipient = makeAddr("unapprovedRecipient");

        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAllowedRecipient.selector);
        wallet.executeAsAgent(unapprovedRecipient, 0.01 ether, "");
    }

    function test_AgentCanPayApprovedRecipientDirectly() public {
        address approvedRecipient = makeAddr("approvedRecipient");
        vm.prank(owner);
        wallet.setAllowedRecipient(approvedRecipient, true);

        vm.prank(agent);
        wallet.executeAsAgent(approvedRecipient, 0.01 ether, "");

        assertEq(approvedRecipient.balance, 0.01 ether);
        assertEq(wallet.spentToday(), 0.01 ether);
    }

    function test_ExpiredPolicyRejectsAgent() public {
        // Warp past policy validUntil
        vm.warp(validUntil + 1);

        vm.prank(agent);
        vm.expectRevert(AgentWallet.PolicyExpired.selector);
        wallet.executeAsAgent(
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        // Also test rejection at EntryPoint validation
        bytes memory callData = abi.encodeWithSelector(
            wallet.executeAsAgent.selector,
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        PackedUserOperation memory op = _buildUserOp(
            address(wallet),
            wallet.getNonce(),
            callData,
            agentPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // EntryPoint rejects with AA22 expired or not due
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA22 expired or not due"));
        entryPoint.handleOps(ops, payable(owner));
    }

    function test_RevokedAgentCannotSpend() public {
        vm.prank(owner);
        wallet.revokeAgent();

        assertEq(wallet.agent(), address(0));

        vm.prank(agent);
        vm.expectRevert(AgentWallet.NotAgent.selector);
        wallet.executeAsAgent(
            address(merchant),
            0.01 ether,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, 10)
        );

        // Owner can still execute
        address recipient = makeAddr("postRevocationRecipient");
        vm.prank(owner);
        wallet.execute(recipient, 0.1 ether, "");
        assertEq(recipient.balance, 0.1 ether);
    }

    function test_FailedCallRevertsWithoutConsumingDailyLimit() public {
        // MockMerchant reverts if insufficient ETH is sent for requested credits
        // Request 100 credits (requires 0.1 ether), but only send 0.01 ether
        bytes memory badCall = abi.encodeWithSelector(MockMerchant.buyCredits.selector, 100);

        vm.prank(agent);
        vm.expectRevert("MockMerchant: insufficient ETH sent");
        wallet.executeAsAgent(address(merchant), 0.01 ether, badCall);

        // Daily spent must remain 0 because the call reverted
        assertEq(wallet.spentToday(), 0);
    }

    function testFuzz_DailyLimitEnforced(uint256 pay1, uint256 pay2) public {
        vm.assume(pay1 <= MAX_PER_TX);
        vm.assume(pay2 <= MAX_PER_TX);

        uint256 units1 = pay1 / merchant.PRICE_PER_CREDIT();
        vm.prank(agent);
        wallet.executeAsAgent(
            address(merchant),
            pay1,
            abi.encodeWithSelector(MockMerchant.buyCredits.selector, units1)
        );

        assertEq(wallet.spentToday(), pay1);

        uint256 units2 = pay2 / merchant.PRICE_PER_CREDIT();
        if (pay1 + pay2 > DAILY_LIMIT) {
            vm.prank(agent);
            vm.expectRevert(AgentWallet.ExceedsDailyLimit.selector);
            wallet.executeAsAgent(
                address(merchant),
                pay2,
                abi.encodeWithSelector(MockMerchant.buyCredits.selector, units2)
            );
            assertEq(wallet.spentToday(), pay1);
        } else {
            vm.prank(agent);
            wallet.executeAsAgent(
                address(merchant),
                pay2,
                abi.encodeWithSelector(MockMerchant.buyCredits.selector, units2)
            );
            assertEq(wallet.spentToday(), pay1 + pay2);
        }
    }
}
